import type { AgentState, AgentStore } from './agentStore';

export function createCloudflareAgentStore(doNamespace: DurableObjectNamespace): AgentStore {
	return {
		async fetch(request: Request): Promise<Response> {
			const stub = doNamespace.get(doNamespace.idFromName('default'));
			return stub.fetch(request);
		},

		async getSessionState(_sessionId: string): Promise<AgentState | null> {
			throw new Error('Cloudflare agent store does not expose direct access to Durable Object state.');
		},

		async putSessionState(_sessionId: string, _state: AgentState): Promise<void> {
			throw new Error('Cloudflare agent store does not expose direct access to Durable Object state.');
		},
	};
}
