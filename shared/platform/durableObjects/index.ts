import { registerAgentStore, createAgentStore } from './agentStore';
import { createCloudflareAgentStore } from './cloudflareAgentStore';
import { createGcpAgentStore } from './gcpAgentStore';

registerAgentStore('cloudflare', (env) => {
	const namespace = (env as Record<string, unknown>).CodeGeneratorAgent as DurableObjectNamespace | undefined;
	if (!namespace) {
		throw new Error('CodeGeneratorAgent Durable Object namespace is not available on this environment.');
	}
	return createCloudflareAgentStore(namespace);
});

registerAgentStore('gcp', (env) => createGcpAgentStore(env));

export { createAgentStore };
export type { AgentStore } from './agentStore';
