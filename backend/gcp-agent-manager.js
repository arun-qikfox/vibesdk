const crypto = require('crypto');

const agentEntries = new Map();
let agentModulePromise = null;
let websocketModulePromise = null;

async function loadAgentModule() {
    if (!agentModulePromise) {
        agentModulePromise = import('../worker/agents/core/postgresAgent.js');
    }
    return agentModulePromise;
}

async function loadWebsocketModule() {
    if (!websocketModulePromise) {
        websocketModulePromise = import('../worker/agents/core/websocket.js');
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
        connections
    };
    agentEntries.set(agentId, entry);
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

module.exports = {
    ensureAgent,
    getAgent,
    attachConnection,
};
