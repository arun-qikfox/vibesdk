/**
 * Node.js compatible stub for WebSocket handling
 * Provides minimal interface for GCP agent manager
 */

function handleWebSocketMessage(agent, ws, rawMessage) {
    try {
        // Stub implementation - just log the message
        console.log(`[WebSocket Stub] Message received for agent ${agent.getAgentId()}:`, rawMessage);
    } catch (error) {
        console.error('[WebSocket Stub] Error handling message:', error);
    }
}

function handleWebSocketClose(ws) {
    try {
        // Stub implementation - just log the close
        console.log('[WebSocket Stub] Connection closed');
    } catch (error) {
        console.error('[WebSocket Stub] Error handling close:', error);
    }
}

module.exports = {
    handleWebSocketMessage,
    handleWebSocketClose
};
