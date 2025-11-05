/**
 * Node.js compatible shim for WebSocket handling.
 * Mirrors the shape of the Cloudflare Worker implementation enough for local testing.
 */

const RESPONSES = {
    GENERATION_STARTED: 'generation_started',
    GENERATION_COMPLETE: 'generation_complete',
    FILE_GENERATING: 'file_generating',
    FILE_CHUNK_GENERATED: 'file_chunk_generated',
    FILE_GENERATED: 'file_generated',
    DEPLOYMENT_STARTED: 'deployment_started',
    DEPLOYMENT_COMPLETED: 'deployment_completed',
    ERROR: 'error',
    CONVERSATION_STATE: 'conversation_state',
    MODEL_CONFIGS_INFO: 'model_configs_info'
};

const REQUESTS = {
    GENERATE_ALL: 'generate_all',
    GET_CONVERSATION_STATE: 'get_conversation_state',
    PREVIEW: 'preview',
    CODE_REVIEW: 'code_review',
    GET_MODEL_CONFIGS: 'get_model_configs'
};

function send(ws, type, payload = {}) {
    try {
        ws.send(JSON.stringify({ type, ...payload }));
    } catch (error) {
        console.error('[WebSocket Stub] Failed to send message', { type, error });
    }
}

function broadcast(agent, type, payload = {}) {
    if (agent && typeof agent._broadcast === 'function') {
        agent._broadcast(type, payload);
        return;
    }

    const sockets = typeof agent?.getWebSockets === 'function' ? agent.getWebSockets() || [] : [];
    for (const socket of sockets) {
        send(socket, type, payload);
    }
}

function handleWebSocketMessage(agent, ws, rawMessage) {
    try {
        console.log(`[WebSocket Stub] Message received for agent ${agent.getAgentId()}:`, rawMessage);
        const parsed = JSON.parse(rawMessage);

        switch (parsed.type) {
            case REQUESTS.GET_CONVERSATION_STATE: {
                const state = typeof agent.getConversationState === 'function'
                    ? agent.getConversationState()
                    : { messages: [], updatedAt: Date.now() };
                send(ws, RESPONSES.CONVERSATION_STATE, { state });
                break;
            }
            case REQUESTS.GENERATE_ALL: {
                if (typeof agent.simulateGeneration === 'function') {
                    agent.simulateGeneration();
                } else {
                    broadcast(agent, RESPONSES.GENERATION_STARTED, {
                        message: 'Starting stub generation',
                        totalFiles: 0
                    });
                    broadcast(agent, RESPONSES.GENERATION_COMPLETE, {
                        message: 'Stub generation completed'
                    });
                }
                break;
            }
            case REQUESTS.PREVIEW: {
                if (typeof agent.deployToSandbox === 'function') {
                    agent.deployToSandbox()
                        .then((result) => {
                            if (result?.previewURL) {
                                broadcast(agent, RESPONSES.DEPLOYMENT_COMPLETED, {
                                    message: 'Preview available',
                                    previewURL: result.previewURL
                                });
                            }
                        })
                        .catch((error) => {
                            broadcast(agent, RESPONSES.ERROR, {
                                error: error instanceof Error ? error.message : String(error)
                            });
                        });
                } else {
                    send(ws, RESPONSES.ERROR, { error: 'Preview not supported in stub' });
                }
                break;
            }
            case REQUESTS.CODE_REVIEW: {
                if (typeof agent.reviewCode === 'function') {
                    agent.reviewCode()
                        .then((review) => {
                            send(ws, RESPONSES.CONVERSATION_STATE, {
                                state: {
                                    ...agent.getConversationState?.(),
                                    lastReview: review
                                }
                            });
                        })
                        .catch((error) => {
                            send(ws, RESPONSES.ERROR, {
                                error: error instanceof Error ? error.message : String(error)
                            });
                        });
                } else {
                    send(ws, RESPONSES.ERROR, { error: 'Code review not supported in stub' });
                }
                break;
            }
            case REQUESTS.GET_MODEL_CONFIGS: {
                if (typeof agent.getModelConfigsInfo === 'function') {
                    agent.getModelConfigsInfo()
                        .then((configs) => {
                            send(ws, RESPONSES.MODEL_CONFIGS_INFO, {
                                message: 'Model configurations retrieved',
                                configs
                            });
                        })
                        .catch((error) => {
                            send(ws, RESPONSES.ERROR, {
                                error: error instanceof Error ? error.message : String(error)
                            });
                        });
                } else {
                    send(ws, RESPONSES.MODEL_CONFIGS_INFO, { configs: {} });
                }
                break;
            }
            default:
                send(ws, RESPONSES.ERROR, { error: `Unknown message type: ${parsed.type}` });
        }
    } catch (error) {
        console.error('[WebSocket Stub] Error handling message:', error);
        send(ws, RESPONSES.ERROR, {
            error: error instanceof Error ? error.message : String(error)
        });
    }
}

function handleWebSocketClose(ws) {
    try {
        console.log('[WebSocket Stub] Connection closed');
    } catch (error) {
        console.error('[WebSocket Stub] Error handling close:', error);
    }
}

module.exports = {
    handleWebSocketMessage,
    handleWebSocketClose
};
