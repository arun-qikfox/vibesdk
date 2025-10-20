import { getRuntimeProvider } from 'shared/platform/runtimeProvider';
import { SandboxSdkClient } from './sandboxSdkClient';
import { RemoteSandboxServiceClient } from './remoteSandboxService';
import { BaseSandboxService } from './BaseSandboxService';
import { GcpSandboxService } from './gcpSandboxService';

export function getSandboxService(
	env: Env,
	sessionId: string,
	agentId: string,
): BaseSandboxService {
	const provider = getRuntimeProvider(env);

	if (provider === 'gcp') {
		return new GcpSandboxService(env, sessionId, agentId);
	}

	if (env.SANDBOX_SERVICE_TYPE === 'runner') {
		console.log('[getSandboxService] Using runner service for sandboxing');
		return new RemoteSandboxServiceClient(sessionId);
	}

	console.log('[getSandboxService] Using sandboxsdk service for sandboxing');
	return new SandboxSdkClient(sessionId, agentId);
}
