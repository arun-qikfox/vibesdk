const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const Module = require('module');
const ts = require('typescript');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PATH_ALIASES = {
    'worker/': path.join(PROJECT_ROOT, 'worker/'),
    'shared/': path.join(PROJECT_ROOT, 'shared/'),
    'backend/': path.join(PROJECT_ROOT, 'backend/'),
};

const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.cjs', '.mjs', '.json'];

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
        const agentPath = path.resolve(__dirname, '../worker/agents/core/postgresAgent.cjs');
        console.log(`[GCP Agent Manager] Loading agent implementation from: ${agentPath}`);
        agentModulePromise = Promise.resolve().then(() => require(agentPath));
    }
    return agentModulePromise;
}

async function loadWebsocketModule() {
    if (!websocketModulePromise) {
        const websocketPath = path.resolve(__dirname, '../worker/agents/core/websocket.cjs');
        websocketModulePromise = Promise.resolve().then(() => require(websocketPath));
    }
    return websocketModulePromise;
}

function createDurableObjectContext(agentId, connections) {
    const tables = {
        cf_agents_state: new Map(),
        cf_agents_queues: new Map(),
        cf_agents_schedules: new Map(),
        cf_agents_mcp_servers: new Map(),
    };

    let nextQueueTimestamp = 0;

    const makeResult = (rows = []) => ({
        toArray: () => rows,
        [Symbol.iterator]: function* iterator() {
            for (const row of rows) {
                yield row;
            }
        }
    });

    const kvStore = new Map();

    const storage = {
        sql: {
            exec: (query = '', ...params) => {
                const trimmed = (query || '').trim();
                const upper = trimmed.toUpperCase();

                // No-op DDL
                if (upper.startsWith('CREATE TABLE') || upper.startsWith('DROP TABLE')) {
                    if (upper.includes('CF_AGENTS_STATE')) {
                        tables.cf_agents_state.clear();
                    }
                    if (upper.includes('CF_AGENTS_QUEUES')) {
                        tables.cf_agents_queues.clear();
                    }
                    if (upper.includes('CF_AGENTS_SCHEDULES')) {
                        tables.cf_agents_schedules.clear();
                    }
                    if (upper.includes('CF_AGENTS_MCP_SERVERS')) {
                        tables.cf_agents_mcp_servers.clear();
                    }
                    return makeResult([]);
                }

                // CF Agents State
                if (upper.startsWith('INSERT OR REPLACE INTO CF_AGENTS_STATE')) {
                    const [id, state] = params;
                    tables.cf_agents_state.set(String(id), { id: String(id), state });
                    return makeResult([]);
                }
                if (upper.startsWith('SELECT STATE FROM CF_AGENTS_STATE')) {
                    const [id] = params;
                    const row = tables.cf_agents_state.get(String(id));
                    return makeResult(row ? [{ state: row.state }] : []);
                }
                if (upper.startsWith('SELECT * FROM CF_AGENTS_STATE')) {
                    const rows = Array.from(tables.cf_agents_state.values()).map((row) => ({ ...row }));
                    return makeResult(rows);
                }

                // CF Agents Queues
                if (upper.startsWith('INSERT OR REPLACE INTO CF_AGENTS_QUEUES')) {
                    const [id, payload, callback] = params;
                    const created_at = Math.floor(Date.now() / 1000) + nextQueueTimestamp++;
                    tables.cf_agents_queues.set(String(id), {
                        id: String(id),
                        payload,
                        callback,
                        created_at,
                    });
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
                        rows = rows.sort((a, b) => a.created_at - b.created_at);
                    }
                    return makeResult(rows);
                }
                if (upper.startsWith('DELETE FROM CF_AGENTS_QUEUES WHERE ID =')) {
                    const [id] = params;
                    tables.cf_agents_queues.delete(String(id));
                    return makeResult([]);
                }
                if (upper.startsWith('DELETE FROM CF_AGENTS_QUEUES WHERE CALLBACK =')) {
                    const [callback] = params;
                    for (const [id, row] of tables.cf_agents_queues.entries()) {
                        if (row.callback === callback) {
                            tables.cf_agents_queues.delete(id);
                        }
                    }
                    return makeResult([]);
                }
                if (upper.startsWith('DELETE FROM CF_AGENTS_QUEUES')) {
                    tables.cf_agents_queues.clear();
                    return makeResult([]);
                }

                // CF Agents Schedules
                if (upper.startsWith('INSERT OR REPLACE INTO CF_AGENTS_SCHEDULES')) {
                    const [id, callback, payload, fourth, fifth] = params;
                    let type = 'scheduled';
                    if (upper.includes("'DELAYED'")) {
                        type = 'delayed';
                    } else if (upper.includes("'CRON'")) {
                        type = 'cron';
                    }

                    const row = {
                        id: String(id),
                        callback,
                        payload,
                        type,
                        time: null,
                        delayInSeconds: null,
                        cron: null,
                    };

                    if (type === 'scheduled') {
                        row.time = Number(fourth);
                    } else if (type === 'delayed') {
                        row.delayInSeconds = Number(fourth);
                        row.time = Number(fifth);
                    } else if (type === 'cron') {
                        row.cron = String(fourth);
                        row.time = Number(fifth);
                    }

                    tables.cf_agents_schedules.set(String(id), row);
                    return makeResult([]);
                }
                if (upper.startsWith('SELECT * FROM CF_AGENTS_SCHEDULES WHERE ID =')) {
                    const [id] = params;
                    const row = tables.cf_agents_schedules.get(String(id));
                    return makeResult(row ? [{ ...row }] : []);
                }
                if (upper.includes('SELECT * FROM CF_AGENTS_SCHEDULES')) {
                    let rows = Array.from(tables.cf_agents_schedules.values()).map((row) => ({ ...row }));
                    const conditionRegex = /\b(ID|TYPE|CALLBACK|CRON|DELAYINSECONDS|TIME)\s*(<=|>=|=|>)\s*\?/g;
                    let match;
                    let paramIndex = 0;
                    while ((match = conditionRegex.exec(upper)) !== null) {
                        const [, column, operator] = match;
                        const rawValue = params[paramIndex++];
                        rows = rows.filter((row) => {
                            if (rawValue === undefined) {
                                return true;
                            }
                            const value =
                                column === 'TIME' || column === 'DELAYINSECONDS'
                                    ? Number(rawValue)
                                    : rawValue;
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
                                    return column === 'ID'
                                        ? String(target) === String(value)
                                        : target === value;
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
                    const row = tables.cf_agents_schedules.get(String(id));
                    if (row) {
                        row.time = Number(time);
                        tables.cf_agents_schedules.set(String(id), row);
                    }
                    return makeResult([]);
                }
                if (upper.startsWith('DELETE FROM CF_AGENTS_SCHEDULES WHERE ID =')) {
                    const [id] = params;
                    tables.cf_agents_schedules.delete(String(id));
                    return makeResult([]);
                }
                if (upper.startsWith('DELETE FROM CF_AGENTS_SCHEDULES WHERE CALLBACK =')) {
                    const [callback] = params;
                    for (const [id, row] of tables.cf_agents_schedules.entries()) {
                        if (row.callback === callback) {
                            tables.cf_agents_schedules.delete(id);
                        }
                    }
                    return makeResult([]);
                }
                if (upper.startsWith('DELETE FROM CF_AGENTS_SCHEDULES')) {
                    tables.cf_agents_schedules.clear();
                    return makeResult([]);
                }

                // CF Agents MCP servers
                if (upper.startsWith('INSERT OR REPLACE INTO CF_AGENTS_MCP_SERVERS')) {
                    const [id, name, server_url, client_id, auth_url, callback_url, server_options] = params;
                    tables.cf_agents_mcp_servers.set(String(id), {
                        id: String(id),
                        name,
                        server_url,
                        client_id,
                        auth_url,
                        callback_url,
                        server_options,
                    });
                    return makeResult([]);
                }
                if (upper.startsWith('SELECT ID, NAME') && upper.includes('CF_AGENTS_MCP_SERVERS')) {
                    const rows = Array.from(tables.cf_agents_mcp_servers.values()).map((row) => ({ ...row }));
                    return makeResult(rows);
                }
                if (upper.startsWith('DELETE FROM CF_AGENTS_MCP_SERVERS WHERE ID =')) {
                    const [id] = params;
                    tables.cf_agents_mcp_servers.delete(String(id));
                    return makeResult([]);
                }

                console.warn('[GCP Agent Manager] Unhandled SQL query', { query: trimmed, params });
                return makeResult([]);
            }
        },
        async get(key) {
            return kvStore.get(key);
        },
        async list() {
            return new Map(kvStore);
        },
        async put(key, value) {
            kvStore.set(key, value);
        },
        async delete(key) {
            kvStore.delete(key);
        },
        async deleteAll() {
            tables.cf_agents_state.clear();
            tables.cf_agents_queues.clear();
            tables.cf_agents_schedules.clear();
            tables.cf_agents_mcp_servers.clear();
            kvStore.clear();
        },
        async setAlarm() {
            return;
        },
        async getAlarm() {
            return null;
        },
        async deleteAlarm() {
            return;
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
    const { PostgresCodeGeneratorAgent } = await loadAgentModule();
    const connections = new Set();
    const ctx = createDurableObjectContext(agentId, connections);
    const agent = new PostgresCodeGeneratorAgent(ctx, env);
    agent.getWebSockets = () => Array.from(connections);
    const entry = {
        agent,
        connections,
        initialized: false, // Track initialization status
        initializationPromise: null
    };
    agentEntries.set(agentId, entry);
    console.log(`[GCP Agent Manager] Created agent ${agentId} and stored in manager`);
    return entry;
}

async function ensureAgent(agentId, env) {
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
