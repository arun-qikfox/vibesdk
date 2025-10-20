export interface AgentState {
	sessionId: string;
	payload: unknown;
}

export interface AgentStore {
	fetch(request: Request): Promise<Response>;
	getSessionState(sessionId: string): Promise<AgentState | null>;
	putSessionState(sessionId: string, state: AgentState): Promise<void>;
}

type EnvLike = Record<string, unknown> | undefined;

type Factory = (env: EnvLike) => AgentStore;

const factories: Record<string, Factory> = {};

export function registerAgentStore(provider: string, factory: Factory): void {
	factories[provider] = factory;
}

export function createAgentStore(provider: string, env: EnvLike): AgentStore {
	const factory = factories[provider];
	if (!factory) {
		throw new Error('Agent store for provider "' + provider + '" is not registered.');
	}
	return factory(env);
}
