import { getRuntimeProvider } from 'shared/platform/runtimeProvider';
import { createAgentStore } from 'shared/platform/durableObjects';
import type { AgentStore } from 'shared/platform/durableObjects';
import type { AgentState } from 'shared/platform/durableObjects/agentStore';

type EnvRecord = Record<string, unknown>;

export function getAgentStore(env: Env): AgentStore | null {
	const record = env as unknown as EnvRecord;
	if (record.AgentStore && typeof record.AgentStore === 'object') {
		return record.AgentStore as AgentStore;
	}

	const provider = getRuntimeProvider(env);
	try {
		const store = createAgentStore(provider, record);
		record.AgentStore = store;
		return store;
	} catch (error) {
		console.warn('Agent store unavailable', { provider, error });
		return null;
	}
}

export function buildAgentState(sessionId: string, payload: unknown): AgentState {
	return { sessionId, payload };
}
