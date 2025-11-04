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
        const agentPath = path.resolve(__dirname, '../worker/agents/core/postgresAgent.ts');
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

function createDurableObjectContext(agentId, connections) {
    const storageData = new Map();

    const sqlResult = {
        toArray: () => [],
        [Symbol.iterator]: function* iterator() {
            return [];
        }
    };

    const storage = {
        sql: {
            exec: () => sqlResult
        },
        async get(key) {
            return storageData.get(key);
        },
        async list() {
            return new Map(storageData);
        },
        async put(key, value) {
            storageData.set(key, value);
        },
        async delete(key) {
            storageData.delete(key);
        },
        async deleteAll() {
            storageData.clear();
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
