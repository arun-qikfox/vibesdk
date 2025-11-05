const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const Module = require('module');
const ts = require('typescript');

let FirestoreModule = null;
let FirestoreCtor = null;
let FirestoreTimestamp = null;
let FirestoreFieldValue = null;

try {
    FirestoreModule = require('@google-cloud/firestore');
    FirestoreCtor = FirestoreModule.Firestore;
    FirestoreTimestamp = FirestoreModule.Timestamp;
    FirestoreFieldValue = FirestoreModule.FieldValue || null;
} catch (error) {
    console.warn('[GCP Agent Manager] Firestore SDK not available; durable storage will fall back to in-memory shims.', error?.message || error);
}

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PATH_ALIASES = {
    'worker/': path.join(PROJECT_ROOT, 'worker/'),
    'shared/': path.join(PROJECT_ROOT, 'shared/'),
    'backend/': path.join(PROJECT_ROOT, 'backend/'),
};

const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.cjs', '.mjs', '.json'];
const DURABLE_ROOT_COLLECTION = 'cf_agents';
const DURABLE_SUBCOLLECTIONS = {
    state: 'state',
    queues: 'queues',
    schedules: 'schedules',
    mcp: 'mcp',
    kv: 'kv',
};

const firestoreClients = new Map();
const persistedWarnings = {
    missingProjectId: false,
    missingFirestore: false,
};
const alarmTimers = new Map();

function resolveProjectId(env) {
    if (env && typeof env === 'object') {
        for (const key of ['GCP_PROJECT_ID', 'GOOGLE_CLOUD_PROJECT', 'GCLOUD_PROJECT']) {
            const value = env[key];
            if (typeof value === 'string' && value.trim().length > 0) {
                return value.trim();
            }
        }
    }
    for (const key of ['GCP_PROJECT_ID', 'GOOGLE_CLOUD_PROJECT', 'GCLOUD_PROJECT']) {
        const value = process.env[key];
        if (typeof value === 'string' && value.trim().length > 0) {
            return value.trim();
        }
    }
    return undefined;
}

function getFirestoreClient(env) {
    if (!FirestoreCtor || !FirestoreTimestamp) {
        if (!persistedWarnings.missingFirestore) {
            console.warn('[GCP Agent Manager] Firestore module unavailable. Durable Object state will not persist across processes.');
            persistedWarnings.missingFirestore = true;
        }
        return null;
    }
    const projectId = resolveProjectId(env);
    if (!projectId) {
        if (!persistedWarnings.missingProjectId) {
            console.warn('[GCP Agent Manager] GCP_PROJECT_ID (or GOOGLE_CLOUD_PROJECT/GCLOUD_PROJECT) not set; using in-memory durable storage for agents.');
            persistedWarnings.missingProjectId = true;
        }
        return null;
    }
    if (firestoreClients.has(projectId)) {
        return firestoreClients.get(projectId);
    }
    try {
        const client = new FirestoreCtor({ projectId });
        firestoreClients.set(projectId, client);
        return client;
    } catch (error) {
        console.error(`[GCP Agent Manager] Failed to initialize Firestore client for project ${projectId}`, error);
        return null;
    }
}

function fireAndForget(promise, context) {
    if (!promise || typeof promise.then !== 'function') {
        return;
    }
    promise.catch((error) => {
        console.error('[GCP Agent Manager] Firestore persistence error', { context, error });
    });
}

async function deleteCollection(collectionRef) {
    const snapshot = await collectionRef.get();
    if (snapshot.empty) {
        return;
    }
    const deletes = snapshot.docs.map((doc) => doc.ref.delete());
    await Promise.allSettled(deletes);
}

function resolveWithExtensions(basePath) {
    if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
        return basePath;
    }
    for (const ext of EXTENSIONS) {
        const candidate = basePath.endsWith(ext) ? basePath : basePath + ext;
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return candidate;
        }
    }
    for (const ext of EXTENSIONS) {
        const candidate = path.join(basePath, 'index' + ext);
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return candidate;
        }
    }
    return null;
}

function resolveSpecifier(specifier, baseDir) {
    if (specifier.startsWith('.')) {
        return resolveWithExtensions(path.resolve(baseDir, specifier));
    }
    for (const [prefix, targetDir] of Object.entries(PATH_ALIASES)) {
        if (specifier.startsWith(prefix)) {
            const relativePath = specifier.slice(prefix.length);
            return resolveWithExtensions(path.join(targetDir, relativePath));
        }
    }
    return null;
}

// Map Cloudflare-specific imports and project aliases so worker code can run in Node
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
    if (request === 'cloudflare:workers') {
        return path.resolve(__dirname, 'shims/cloudflare-workers.js');
    }
    if (request === '@cloudflare/sandbox') {
        return path.resolve(__dirname, 'shims/cloudflare-sandbox.js');
    }
    if (request === 'cloudflare:email') {
        return path.resolve(__dirname, 'shims/cloudflare-email.js');
    }
    if (request.startsWith('cloudflare:')) {
        return path.resolve(__dirname, 'shims/cloudflare-generic.js');
    }
    for (const [prefix, targetDir] of Object.entries(PATH_ALIASES)) {
        if (request.startsWith(prefix)) {
            const relativePath = request.slice(prefix.length);
            const resolved = resolveWithExtensions(path.join(targetDir, relativePath));
            if (resolved) {
                return resolved;
            }
        }
    }
    return originalResolveFilename.call(this, request, parent, isMain, options);
};

const agentEntries = new Map();
let agentModulePromise = null;
let websocketModulePromise = null;

const tsModuleCache = new Map();
let gcpAgentStoreModule = null;

function loadTsModule(filePath) {
    const normalizedPath = path.resolve(filePath);
    if (tsModuleCache.has(normalizedPath)) {
        return tsModuleCache.get(normalizedPath);
    }

    const source = fs.readFileSync(normalizedPath, 'utf8');
    const transpiled = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2020,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            esModuleInterop: true,
            resolveJsonModule: true,
            jsx: ts.JsxEmit.React,
            allowSyntheticDefaultImports: true,
        },
        fileName: normalizedPath,
    });

    const module = { exports: {} };
    const baseDir = path.dirname(normalizedPath);

    function tsAwareRequire(specifier) {
        const resolved = resolveSpecifier(specifier, baseDir);
        if (resolved) {
            const ext = path.extname(resolved);
            if (ext === '.ts' || ext === '.tsx') {
                return loadTsModule(resolved);
            }
            return require(resolved);
        }
        return require(specifier);
    }

    const wrapped = new Function('require', 'module', 'exports', '__dirname', '__filename', transpiled.outputText);
    wrapped(tsAwareRequire, module, module.exports, baseDir, normalizedPath);
    tsModuleCache.set(normalizedPath, module.exports);
    return module.exports;
}

async function loadAgentModule() {
    if (!agentModulePromise) {
        const agentPath = path.resolve(__dirname, '../worker/agents/core/simpleGeneratorAgent.ts');
        console.log(`[GCP Agent Manager] Loading agent implementation from: ${agentPath}`);
        agentModulePromise = Promise.resolve().then(() => loadTsModule(agentPath));
    }
    return agentModulePromise;
}

async function loadWebsocketModule() {
    if (!websocketModulePromise) {
        const websocketPath = path.resolve(__dirname, '../worker/agents/core/websocket.ts');
        websocketModulePromise = Promise.resolve().then(() => loadTsModule(websocketPath));
    }
    return websocketModulePromise;
}

function cancelScheduledAlarm(agentId) {
    const existing = alarmTimers.get(agentId);
    if (existing && existing.handle) {
        clearTimeout(existing.handle);
    }
    alarmTimers.delete(agentId);
}

function triggerAgentAlarm(agentId) {
    cancelScheduledAlarm(agentId);
    const entry = agentEntries.get(agentId);
    if (!entry || !entry.agent || typeof entry.agent.alarm !== 'function') {
        return;
    }
    Promise.resolve()
        .then(() => entry.agent.alarm())
        .catch((error) => {
            console.error(`[GCP Agent Manager] Agent alarm execution failed for ${agentId}`, error);
        });
}

function scheduleAgentAlarm(agentId, timestamp) {
    if (typeof timestamp !== 'number' || Number.isNaN(timestamp)) {
        cancelScheduledAlarm(agentId);
        return;
    }
    const delay = Math.max(timestamp - Date.now(), 0);
    cancelScheduledAlarm(agentId);
    const handle = setTimeout(() => triggerAgentAlarm(agentId), delay);
    alarmTimers.set(agentId, { handle, timestamp });
}

function ensureGcpRuntimeEnv(env) {
    if (!env || typeof env !== 'object') {
        return;
    }
    if (!('RUNTIME_PROVIDER' in env) || typeof env.RUNTIME_PROVIDER !== 'string') {
        env.RUNTIME_PROVIDER = process.env.RUNTIME_PROVIDER || 'gcp';
    }
    if (env.AgentStore) {
        return;
    }
    try {
        if (!gcpAgentStoreModule) {
            gcpAgentStoreModule = loadTsModule(path.resolve(PROJECT_ROOT, 'shared/platform/durableObjects/gcpAgentStore.ts'));
        }
        if (gcpAgentStoreModule && typeof gcpAgentStoreModule.createGcpAgentStore === 'function') {
            env.AgentStore = gcpAgentStoreModule.createGcpAgentStore(env);
        }
    } catch (error) {
        console.warn('[GCP Agent Manager] Failed to attach GCP AgentStore', error);
    }
}

function serializeKvValue(value) {
    if (value === undefined) {
        return { type: 'undefined' };
    }
    if (value === null) {
        return { type: 'null' };
    }
    if (Buffer.isBuffer(value)) {
        return { type: 'buffer', data: value.toString('base64') };
    }
    if (value instanceof Uint8Array) {
        return { type: 'uint8array', data: Buffer.from(value).toString('base64') };
    }
    if (value instanceof ArrayBuffer) {
        return { type: 'arraybuffer', data: Buffer.from(value).toString('base64') };
    }
    if (typeof value === 'string') {
        return { type: 'string', data: value };
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return { type: 'primitive', data: value };
    }
    try {
        return { type: 'json', data: JSON.stringify(value) };
    } catch (error) {
        console.warn('[GCP Agent Manager] Failed to serialize KV value, storing as string', error);
        return { type: 'string', data: String(value) };
    }
}

function deserializeKvValue(record) {
    if (!record || typeof record !== 'object') {
        return undefined;
    }
    switch (record.type) {
        case 'undefined':
            return undefined;
        case 'null':
            return null;
        case 'buffer':
        case 'uint8array':
        case 'arraybuffer': {
            const buffer = Buffer.from(record.data || '', 'base64');
            if (record.type === 'buffer') {
                return buffer;
            }
            if (record.type === 'uint8array') {
                return new Uint8Array(buffer);
            }
            return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        }
        case 'string':
            return record.data;
        case 'primitive':
            return record.data;
        case 'json':
            try {
                return JSON.parse(record.data || 'null');
            } catch (error) {
                console.warn('[GCP Agent Manager] Failed to parse stored KV json payload', error);
                return null;
            }
        default:
            return record.data;
    }
}

function createNoopPersistence() {
    const noop = async () => {};
    return {
        state: { upsert: noop, delete: noop, clear: noop },
        queues: { upsert: noop, delete: noop, deleteByCallback: noop, clear: noop },
        schedules: { upsert: noop, delete: noop, deleteByCallback: noop, clear: noop, updateTime: noop },
        mcp: { upsert: noop, delete: noop, clear: noop },
        kv: { put: noop, delete: noop, clear: noop },
        alarm: { set: noop, clear: noop },
        refreshRoot: noop,
    };
}

function createFirestorePersistence(firestore, agentId) {
    const root = firestore.collection(DURABLE_ROOT_COLLECTION).doc(agentId);
    const collections = {
        state: root.collection(DURABLE_SUBCOLLECTIONS.state),
        queues: root.collection(DURABLE_SUBCOLLECTIONS.queues),
        schedules: root.collection(DURABLE_SUBCOLLECTIONS.schedules),
        mcp: root.collection(DURABLE_SUBCOLLECTIONS.mcp),
        kv: root.collection(DURABLE_SUBCOLLECTIONS.kv),
    };

    async function touchRoot(extra = {}) {
        await root.set(
            {
                agentId,
                updatedAt: FirestoreTimestamp ? FirestoreTimestamp.now() : new Date(),
                ...extra,
            },
            { merge: true },
        );
    }

    return {
        state: {
            upsert: async (row) => {
                await collections.state.doc(row.id).set(
                    {
                        id: row.id,
                        state: row.state,
                        updatedAt: FirestoreTimestamp ? FirestoreTimestamp.now() : new Date(),
                    },
                    { merge: true },
                );
                await touchRoot();
            },
            delete: async (id) => {
                await collections.state.doc(id).delete();
                await touchRoot();
            },
            clear: async () => {
                await deleteCollection(collections.state);
                await touchRoot();
            },
        },
        queues: {
            upsert: async (row) => {
                await collections.queues.doc(row.id).set(
                    {
                        ...row,
                        updatedAt: FirestoreTimestamp ? FirestoreTimestamp.now() : new Date(),
                    },
                    { merge: true },
                );
                await touchRoot();
            },
            delete: async (id) => {
                await collections.queues.doc(id).delete();
                await touchRoot();
            },
            deleteByCallback: async (callback) => {
                const snapshot = await collections.queues.where('callback', '==', callback).get();
                if (!snapshot.empty) {
                    await Promise.allSettled(snapshot.docs.map((doc) => doc.ref.delete()));
                    await touchRoot();
                }
            },
            clear: async () => {
                await deleteCollection(collections.queues);
                await touchRoot();
            },
        },
        schedules: {
            upsert: async (row) => {
                await collections.schedules.doc(row.id).set(
                    {
                        ...row,
                        updatedAt: FirestoreTimestamp ? FirestoreTimestamp.now() : new Date(),
                    },
                    { merge: true },
                );
                await touchRoot();
            },
            delete: async (id) => {
                await collections.schedules.doc(id).delete();
                await touchRoot();
            },
            deleteByCallback: async (callback) => {
                const snapshot = await collections.schedules.where('callback', '==', callback).get();
                if (!snapshot.empty) {
                    await Promise.allSettled(snapshot.docs.map((doc) => doc.ref.delete()));
                    await touchRoot();
                }
            },
            clear: async () => {
                await deleteCollection(collections.schedules);
                await touchRoot();
            },
            updateTime: async (id, time) => {
                await collections.schedules.doc(id).set(
                    {
                        time,
                        updatedAt: FirestoreTimestamp ? FirestoreTimestamp.now() : new Date(),
                    },
                    { merge: true },
                );
                await touchRoot();
            },
        },
        mcp: {
            upsert: async (row) => {
                await collections.mcp.doc(row.id).set(
                    {
                        ...row,
                        updatedAt: FirestoreTimestamp ? FirestoreTimestamp.now() : new Date(),
                    },
                    { merge: true },
                );
                await touchRoot();
            },
            delete: async (id) => {
                await collections.mcp.doc(id).delete();
                await touchRoot();
            },
            clear: async () => {
                await deleteCollection(collections.mcp);
                await touchRoot();
            },
        },
        kv: {
            put: async (key, record) => {
                await collections.kv.doc(key).set(
                    {
                        key,
                        ...record,
                        updatedAt: FirestoreTimestamp ? FirestoreTimestamp.now() : new Date(),
                    },
                    { merge: true },
                );
                await touchRoot();
            },
            delete: async (key) => {
                await collections.kv.doc(key).delete();
                await touchRoot();
            },
            clear: async () => {
                await deleteCollection(collections.kv);
                await touchRoot();
            },
        },
        alarm: {
            set: async (timestamp) => {
                await touchRoot({
                    alarmTimestamp: timestamp,
                    alarmUpdatedAt: FirestoreTimestamp ? FirestoreTimestamp.now() : new Date(),
                });
            },
            clear: async () => {
                const updates = {
                    alarmUpdatedAt: FirestoreTimestamp ? FirestoreTimestamp.now() : new Date(),
                };
                if (FirestoreFieldValue && typeof FirestoreFieldValue.delete === 'function') {
                    updates.alarmTimestamp = FirestoreFieldValue.delete();
                } else {
                    updates.alarmTimestamp = null;
                }
                await touchRoot(updates);
            },
        },
        refreshRoot: touchRoot,
    };
}

async function hydrateDurableObjectStorage(agentId, env) {
    const defaultState = {
        tables: {
            cf_agents_state: new Map(),
            cf_agents_queues: new Map(),
            cf_agents_schedules: new Map(),
            cf_agents_mcp_servers: new Map(),
        },
        kvStore: new Map(),
        persistence: createNoopPersistence(),
        alarmTimestamp: null,
    };

    const firestore = getFirestoreClient(env);
    if (!firestore) {
        return defaultState;
    }

    try {
        const root = firestore.collection(DURABLE_ROOT_COLLECTION).doc(agentId);
        const [rootSnapshot, stateSnapshot, queueSnapshot, scheduleSnapshot, mcpSnapshot, kvSnapshot] =
            await Promise.all([
                root.get(),
                root.collection(DURABLE_SUBCOLLECTIONS.state).get(),
                root.collection(DURABLE_SUBCOLLECTIONS.queues).get(),
                root.collection(DURABLE_SUBCOLLECTIONS.schedules).get(),
                root.collection(DURABLE_SUBCOLLECTIONS.mcp).get(),
                root.collection(DURABLE_SUBCOLLECTIONS.kv).get(),
            ]);

        const tables = {
            cf_agents_state: new Map(),
            cf_agents_queues: new Map(),
            cf_agents_schedules: new Map(),
            cf_agents_mcp_servers: new Map(),
        };

        stateSnapshot.forEach((doc) => {
            const data = doc.data();
            if (data && typeof data.state === 'string') {
                tables.cf_agents_state.set(doc.id, { id: doc.id, state: data.state });
            }
        });

        queueSnapshot.forEach((doc) => {
            const data = doc.data() || {};
            tables.cf_agents_queues.set(doc.id, {
                id: doc.id,
                payload: data.payload ?? '',
                callback: data.callback ?? '',
                created_at: typeof data.created_at === 'number' ? data.created_at : Math.floor(Date.now() / 1000),
            });
        });

        scheduleSnapshot.forEach((doc) => {
            const data = doc.data() || {};
            tables.cf_agents_schedules.set(doc.id, {
                id: doc.id,
                callback: data.callback ?? '',
                payload: data.payload ?? '',
                type: data.type ?? 'scheduled',
                time: typeof data.time === 'number' ? data.time : null,
                delayInSeconds: typeof data.delayInSeconds === 'number' ? data.delayInSeconds : null,
                cron: data.cron ?? null,
                created_at: typeof data.created_at === 'number' ? data.created_at : Math.floor(Date.now() / 1000),
            });
        });

        mcpSnapshot.forEach((doc) => {
            const data = doc.data() || {};
            tables.cf_agents_mcp_servers.set(doc.id, {
                id: doc.id,
                name: data.name ?? '',
                server_url: data.server_url ?? '',
                callback_url: data.callback_url ?? '',
                client_id: data.client_id ?? '',
                auth_url: data.auth_url ?? '',
                server_options: data.server_options ?? null,
            });
        });

        const kvStore = new Map();
        kvSnapshot.forEach((doc) => {
            const data = doc.data() || {};
            kvStore.set(doc.id, deserializeKvValue(data));
        });

        const persistence = createFirestorePersistence(firestore, agentId);
        const alarmTimestamp = rootSnapshot.exists ? rootSnapshot.data()?.alarmTimestamp ?? null : null;

        return {
            tables,
            kvStore,
            persistence,
            alarmTimestamp: typeof alarmTimestamp === 'number' ? alarmTimestamp : null,
        };
    } catch (error) {
        console.error(`[GCP Agent Manager] Failed to hydrate Firestore durable state for agent ${agentId}`, error);
        return defaultState;
    }
}

async function createDurableObjectContext(agentId, connections, env) {
    const { tables, kvStore, persistence, alarmTimestamp } = await hydrateDurableObjectStorage(agentId, env);
    let currentAlarmTimestamp = typeof alarmTimestamp === 'number' ? alarmTimestamp : null;

    let lastQueueTimestamp = Math.floor(Date.now() / 1000) - 1;
    for (const row of tables.cf_agents_queues.values()) {
        if (typeof row.created_at === 'number' && row.created_at > lastQueueTimestamp) {
            lastQueueTimestamp = row.created_at;
        }
    }

    if (currentAlarmTimestamp !== null) {
        if (currentAlarmTimestamp <= Date.now()) {
            setTimeout(() => triggerAgentAlarm(agentId), 0);
        } else {
            scheduleAgentAlarm(agentId, currentAlarmTimestamp);
        }
    }

    const makeResult = (rows = []) => ({
        toArray: () => rows,
        [Symbol.iterator]: function* iterator() {
            for (const row of rows) {
                yield row;
            }
        }
    });

    const storage = {
        sql: {
            exec: (query = '', ...params) => {
                const trimmed = (query || '').trim();
                if (!trimmed) {
                    return makeResult([]);
                }
                const upper = trimmed.toUpperCase();

                if (upper.startsWith('CREATE TABLE')) {
                    fireAndForget(persistence.refreshRoot(), { op: 'sql:create-table', agentId, query: trimmed });
                    return makeResult([]);
                }

                if (upper.startsWith('DROP TABLE')) {
                    if (upper.includes('CF_AGENTS_STATE')) {
                        tables.cf_agents_state.clear();
                        fireAndForget(persistence.state.clear(), { op: 'sql:drop', table: 'cf_agents_state', agentId });
                    }
                    if (upper.includes('CF_AGENTS_QUEUES')) {
                        tables.cf_agents_queues.clear();
                        fireAndForget(persistence.queues.clear(), { op: 'sql:drop', table: 'cf_agents_queues', agentId });
                    }
                    if (upper.includes('CF_AGENTS_SCHEDULES')) {
                        tables.cf_agents_schedules.clear();
                        fireAndForget(persistence.schedules.clear(), { op: 'sql:drop', table: 'cf_agents_schedules', agentId });
                    }
                    if (upper.includes('CF_AGENTS_MCP_SERVERS')) {
                        tables.cf_agents_mcp_servers.clear();
                        fireAndForget(persistence.mcp.clear(), { op: 'sql:drop', table: 'cf_agents_mcp_servers', agentId });
                    }
                    return makeResult([]);
                }

                if (upper.startsWith('INSERT OR REPLACE INTO CF_AGENTS_STATE')) {
                    const [id, stateRaw] = params;
                    const idStr = String(id);
                    const state = typeof stateRaw === 'string' ? stateRaw : JSON.stringify(stateRaw ?? {});
                    const row = { id: idStr, state };
                    tables.cf_agents_state.set(idStr, row);
                    fireAndForget(persistence.state.upsert(row), { op: 'state.upsert', agentId, id: idStr });
                    return makeResult([]);
                }

                if (upper.startsWith('SELECT STATE FROM CF_AGENTS_STATE')) {
                    const [id] = params;
                    const row = tables.cf_agents_state.get(String(id));
                    return makeResult(row ? [{ state: row.state }] : []);
                }

                if (upper.startsWith('SELECT * FROM CF_AGENTS_STATE')) {
                    return makeResult(Array.from(tables.cf_agents_state.values()).map((row) => ({ ...row })));
                }

                if (upper.startsWith('INSERT OR REPLACE INTO CF_AGENTS_QUEUES')) {
                    const [id, payloadRaw, callbackRaw] = params;
                    const idStr = String(id);
                    const payload = typeof payloadRaw === 'string' ? payloadRaw : JSON.stringify(payloadRaw ?? {});
                    const callback = callbackRaw ? String(callbackRaw) : '';
                    lastQueueTimestamp = Math.max(lastQueueTimestamp + 1, Math.floor(Date.now() / 1000));
                    const row = {
                        id: idStr,
                        payload,
                        callback,
                        created_at: lastQueueTimestamp,
                    };
                    tables.cf_agents_queues.set(idStr, row);
                    fireAndForget(persistence.queues.upsert(row), { op: 'queues.upsert', agentId, id: idStr });
                    return makeResult([]);
                }

                if (upper.startsWith('SELECT * FROM CF_AGENTS_QUEUES WHERE ID =')) {
                    const [id] = params;
                    const row = tables.cf_agents_queues.get(String(id));
                    return makeResult(row ? [{ ...row }] : []);
                }

                if (upper.startsWith('SELECT * FROM CF_AGENTS_QUEUES')) {
                    let rows = Array.from(tables.cf_agents_queues.values()).map((row) => ({ ...row }));
                    if (upper.includes('ORDER BY CREATED_AT')) {
                        rows = rows.sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0));
                    }
                    return makeResult(rows);
                }

                if (upper.startsWith('DELETE FROM CF_AGENTS_QUEUES WHERE ID =')) {
                    const [id] = params;
                    const idStr = String(id);
                    tables.cf_agents_queues.delete(idStr);
                    fireAndForget(persistence.queues.delete(idStr), { op: 'queues.delete', agentId, id: idStr });
                    return makeResult([]);
                }

                if (upper.startsWith('DELETE FROM CF_AGENTS_QUEUES WHERE CALLBACK =')) {
                    const [callback] = params;
                    const callbackStr = String(callback);
                    for (const [rowId, row] of tables.cf_agents_queues.entries()) {
                        if (row.callback === callbackStr) {
                            tables.cf_agents_queues.delete(rowId);
                        }
                    }
                    fireAndForget(persistence.queues.deleteByCallback(callbackStr), { op: 'queues.deleteByCallback', agentId, callback: callbackStr });
                    return makeResult([]);
                }

                if (upper.startsWith('DELETE FROM CF_AGENTS_QUEUES')) {
                    tables.cf_agents_queues.clear();
                    fireAndForget(persistence.queues.clear(), { op: 'queues.clear', agentId });
                    return makeResult([]);
                }

                if (upper.startsWith('INSERT OR REPLACE INTO CF_AGENTS_SCHEDULES')) {
                    const idStr = String(params[0]);
                    const callback = params[1] ? String(params[1]) : '';
                    const payload = typeof params[2] === 'string' ? params[2] : JSON.stringify(params[2] ?? {});

                    const base = tables.cf_agents_schedules.get(idStr);
                    const created_at = typeof base?.created_at === 'number' ? base.created_at : Math.floor(Date.now() / 1000);

                    const row = {
                        id: idStr,
                        callback,
                        payload,
                        type: 'scheduled',
                        time: null,
                        delayInSeconds: null,
                        cron: null,
                        created_at,
                    };

                    if (upper.includes("'DELAYED'")) {
                        row.type = 'delayed';
                        row.delayInSeconds = Number(params[3]);
                        row.time = Number(params[4]);
                    } else if (upper.includes("'CRON'")) {
                        row.type = 'cron';
                        row.cron = String(params[3]);
                        row.time = params.length > 4 ? Number(params[4]) : null;
                    } else {
                        row.type = 'scheduled';
                        row.time = Number(params[3]);
                    }

                    tables.cf_agents_schedules.set(idStr, row);
                    fireAndForget(persistence.schedules.upsert(row), { op: 'schedules.upsert', agentId, id: idStr });
                    return makeResult([]);
                }

                if (upper.startsWith('SELECT * FROM CF_AGENTS_SCHEDULES WHERE ID =')) {
                    const [id] = params;
                    const row = tables.cf_agents_schedules.get(String(id));
                    return makeResult(row ? [{ ...row }] : []);
                }

                if (upper.includes('SELECT * FROM CF_AGENTS_SCHEDULES')) {
                    let rows = Array.from(tables.cf_agents_schedules.values()).map((row) => ({ ...row }));
                    const conditionRegex = /(ID|TYPE|CALLBACK|CRON|DELAYINSECONDS|TIME)\s*(<=|>=|=|>)\s*\?/g;
                    let match;
                    let paramIndex = 0;
                    while ((match = conditionRegex.exec(upper)) !== null) {
                        const [, column, operator] = match;
                        const rawValue = params[paramIndex++];
                        rows = rows.filter((row) => {
                            if (rawValue === undefined) {
                                return true;
                            }
                            const value = column === 'TIME' || column === 'DELAYINSECONDS' ? Number(rawValue) : rawValue;
                            const target =
                                column === 'TIME'
                                    ? row.time ?? null
                                    : column === 'DELAYINSECONDS'
                                    ? row.delayInSeconds ?? null
                                    : column === 'ID'
                                    ? row.id
                                    : column === 'TYPE'
                                    ? row.type
                                    : column === 'CALLBACK'
                                    ? row.callback
                                    : row.cron;
                            if (target == null) {
                                return false;
                            }
                            switch (operator) {
                                case '=':
                                    return column === 'ID' ? String(target) === String(value) : target === value;
                                case '<=':
                                    return Number(target) <= Number(value);
                                case '>=':
                                    return Number(target) >= Number(value);
                                case '>':
                                    return Number(target) > Number(value);
                                default:
                                    return false;
                            }
                        });
                    }
                    if (upper.includes('ORDER BY TIME')) {
                        rows = rows.sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
                    }
                    if (upper.includes('LIMIT 1')) {
                        rows = rows.slice(0, 1);
                    }
                    return makeResult(rows);
                }

                if (upper.startsWith('SELECT TIME FROM CF_AGENTS_SCHEDULES')) {
                    let rows = Array.from(tables.cf_agents_schedules.values()).map((row) => ({ time: row.time }));
                    let paramIndex = 0;
                    if (upper.includes('WHERE TIME >')) {
                        const threshold = Number(params[paramIndex++]);
                        rows = rows.filter((row) => typeof row.time === 'number' && row.time > threshold);
                    }
                    if (upper.includes('ORDER BY TIME')) {
                        rows = rows.sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
                    }
                    if (upper.includes('LIMIT 1')) {
                        rows = rows.slice(0, 1);
                    }
                    return makeResult(rows);
                }

                if (upper.startsWith('UPDATE CF_AGENTS_SCHEDULES SET TIME =')) {
                    const [time, id] = params;
                    const idStr = String(id);
                    const row = tables.cf_agents_schedules.get(idStr);
                    if (row) {
                        row.time = Number(time);
                        tables.cf_agents_schedules.set(idStr, row);
                        fireAndForget(persistence.schedules.updateTime(idStr, row.time), { op: 'schedules.updateTime', agentId, id: idStr, time: row.time });
                    }
                    return makeResult([]);
                }

                if (upper.startsWith('DELETE FROM CF_AGENTS_SCHEDULES WHERE ID =')) {
                    const [id] = params;
                    const idStr = String(id);
                    tables.cf_agents_schedules.delete(idStr);
                    fireAndForget(persistence.schedules.delete(idStr), { op: 'schedules.delete', agentId, id: idStr });
                    return makeResult([]);
                }

                if (upper.startsWith('DELETE FROM CF_AGENTS_SCHEDULES WHERE CALLBACK =')) {
                    const [callback] = params;
                    const callbackStr = String(callback);
                    for (const [rowId, row] of tables.cf_agents_schedules.entries()) {
                        if (row.callback === callbackStr) {
                            tables.cf_agents_schedules.delete(rowId);
                        }
                    }
                    fireAndForget(persistence.schedules.deleteByCallback(callbackStr), { op: 'schedules.deleteByCallback', agentId, callback: callbackStr });
                    return makeResult([]);
                }

                if (upper.startsWith('DELETE FROM CF_AGENTS_SCHEDULES')) {
                    tables.cf_agents_schedules.clear();
                    fireAndForget(persistence.schedules.clear(), { op: 'schedules.clear', agentId });
                    return makeResult([]);
                }

                if (upper.startsWith('INSERT OR REPLACE INTO CF_AGENTS_MCP_SERVERS')) {
                    const [id, name, server_url, client_id, auth_url, callback_url, server_options] = params;
                    const idStr = String(id);
                    const row = {
                        id: idStr,
                        name: name ?? '',
                        server_url: server_url ?? '',
                        client_id: client_id ?? '',
                        auth_url: auth_url ?? '',
                        callback_url: callback_url ?? '',
                        server_options: server_options ?? null,
                    };
                    tables.cf_agents_mcp_servers.set(idStr, row);
                    fireAndForget(persistence.mcp.upsert(row), { op: 'mcp.upsert', agentId, id: idStr });
                    return makeResult([]);
                }

                if (upper.startsWith('SELECT ID, NAME') && upper.includes('CF_AGENTS_MCP_SERVERS')) {
                    const rows = Array.from(tables.cf_agents_mcp_servers.values()).map((row) => ({ ...row }));
                    return makeResult(rows);
                }

                if (upper.startsWith('DELETE FROM CF_AGENTS_MCP_SERVERS WHERE ID =')) {
                    const [id] = params;
                    const idStr = String(id);
                    tables.cf_agents_mcp_servers.delete(idStr);
                    fireAndForget(persistence.mcp.delete(idStr), { op: 'mcp.delete', agentId, id: idStr });
                    return makeResult([]);
                }

                console.warn('[GCP Agent Manager] Unhandled SQL query', { query: trimmed, params });
                return makeResult([]);
            }
        },
        async get(key) {
            return kvStore.get(key);
        },
        async list(options = {}) {
            const entries = Array.from(kvStore.entries());
            if (options && typeof options.prefix === 'string') {
                const prefix = options.prefix;
                return new Map(entries.filter(([entryKey]) => entryKey.startsWith(prefix)));
            }
            return new Map(entries);
        },
        async put(key, value) {
            kvStore.set(key, value);
            const record = serializeKvValue(value);
            fireAndForget(persistence.kv.put(key, record), { op: 'kv.put', agentId, key });
        },
        async delete(key) {
            kvStore.delete(key);
            fireAndForget(persistence.kv.delete(key), { op: 'kv.delete', agentId, key });
        },
        async deleteAll() {
            tables.cf_agents_state.clear();
            tables.cf_agents_queues.clear();
            tables.cf_agents_schedules.clear();
            tables.cf_agents_mcp_servers.clear();
            kvStore.clear();
            fireAndForget(persistence.state.clear(), { op: 'state.clear', agentId });
            fireAndForget(persistence.queues.clear(), { op: 'queues.clear', agentId });
            fireAndForget(persistence.schedules.clear(), { op: 'schedules.clear', agentId });
            fireAndForget(persistence.mcp.clear(), { op: 'mcp.clear', agentId });
            fireAndForget(persistence.kv.clear(), { op: 'kv.clear', agentId });
            cancelScheduledAlarm(agentId);
            currentAlarmTimestamp = null;
            fireAndForget(persistence.alarm.clear(), { op: 'alarm.clear', agentId });
        },
        async setAlarm(when) {
            if (!when) {
                return;
            }
            const timestamp =
                when instanceof Date
                    ? when.getTime()
                    : typeof when === 'number'
                    ? when
                    : Number(when);
            if (!timestamp || Number.isNaN(timestamp)) {
                return;
            }
            currentAlarmTimestamp = timestamp;
            scheduleAgentAlarm(agentId, timestamp);
            fireAndForget(persistence.alarm.set(timestamp), { op: 'alarm.set', agentId, timestamp });
        },
        async getAlarm() {
            return currentAlarmTimestamp ? new Date(currentAlarmTimestamp) : null;
        },
        async deleteAlarm() {
            cancelScheduledAlarm(agentId);
            currentAlarmTimestamp = null;
            fireAndForget(persistence.alarm.clear(), { op: 'alarm.clear', agentId });
        }
    };

    return {
        id: {
            toString: () => agentId
        },
        storage,
        blockConcurrencyWhile: async (fn) => fn(),
        waitUntil: () => {},
        getWebSockets: () => Array.from(connections),
        abort: () => {}
    };
}


async function createAgent(agentId, env) {
    ensureGcpRuntimeEnv(env);
    const { SimpleCodeGeneratorAgent } = await loadAgentModule();
    const connections = new Set();
    const entry = {
        agent: null,
        connections,
        initialized: false,
        initializationPromise: null,
    };
    agentEntries.set(agentId, entry);

    const ctx = await createDurableObjectContext(agentId, connections, env);
    const agent = new SimpleCodeGeneratorAgent(ctx, env);
    entry.agent = agent;
    agent.getWebSockets = () => Array.from(connections);
    if (typeof agent.setConnectionProvider === 'function') {
        agent.setConnectionProvider(() => Array.from(connections));
    }

    console.log(`[GCP Agent Manager] Created agent ${agentId} and stored in manager`);
    return entry;
}

async function ensureAgent(agentId, env) {
    ensureGcpRuntimeEnv(env);
    if (agentEntries.has(agentId)) {
        return agentEntries.get(agentId);
    }
    return createAgent(agentId, env);
}

function getAgent(agentId) {
    return agentEntries.get(agentId) || null;
}

async function attachConnection(agentId, ws, request) {
    const entry = agentEntries.get(agentId);
    if (!entry) {
        return null;
    }

    const { handleWebSocketMessage, handleWebSocketClose } = await loadWebsocketModule();

    ws.id = ws.id || crypto.randomUUID();
    ws.url = ws.url || request?.url || '';
    entry.connections.add(ws);

    ws.on('message', (raw) => {
        try {
            handleWebSocketMessage(entry.agent, ws, raw.toString());
        } catch (error) {
            console.error(`Error handling WebSocket message for agent ${agentId}:`, error);
        }
    });

    ws.on('close', (code, reason) => {
        entry.connections.delete(ws);
        try {
            handleWebSocketClose(ws);
        } catch (error) {
            console.error(`Error handling WebSocket close for agent ${agentId}:`, error);
        }
        if (reason && reason.length > 0) {
            console.log(`WebSocket closed for agent ${agentId} with code ${code}: ${reason.toString()}`);
        }
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error for agent ${agentId}:`, error);
    });

    try {
        ws.send(
            JSON.stringify({
                type: 'connected',
                agentId,
                status: 'completed',
                message: `Connected to agent ${agentId}`,
            }),
        );
    } catch (error) {
        console.warn(`Failed to send initial connected message for agent ${agentId}`, error);
    }

    return entry.agent;
}

function listAgents() {
    return Array.from(agentEntries.keys());
}

module.exports = {
    ensureAgent,
    getAgent,
    attachConnection,
    loadAgentModule, // Export for testing
    listAgents, // Export for debugging
    agentEntries // Export for debugging (read-only)
};
