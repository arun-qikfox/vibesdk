import type { ExecuteResponse, LogEvent, Sandbox } from '@cloudflare/sandbox';
import { getRuntimeProvider } from 'shared/platform/runtimeProvider';
import { createCloudflareSandbox } from './cloudflareSandbox';
import {
	createGcpSandboxExecutor,
	type SandboxExecutor,
	type SandboxExecutionRequest,
	type SandboxResult,
} from './gcpSandbox';

export function getSandbox(env: Env, sandboxId: string): unknown {
	const provider = getRuntimeProvider(env);
	switch (provider) {
		case 'cloudflare':
			return createCloudflareSandbox(env, sandboxId);
		default:
			throw new Error('Sandbox runtime is not implemented for provider ' + provider + '.');
	}
}

export function getSandboxExecutor(env: Env): SandboxExecutor {
	const provider = getRuntimeProvider(env);
	if (provider === 'gcp') {
		return createGcpSandboxExecutor(env as unknown as Record<string, unknown>);
	}
	throw new Error('Sandbox executor not available for provider ' + provider + '.');
}

export { parseSSEStream } from './cloudflareSandbox';
export type {
	Sandbox,
	ExecuteResponse,
	LogEvent,
	SandboxExecutionRequest,
	SandboxResult,
	SandboxExecutor,
};
export { FirestoreSandboxRunStore } from './gcpRunStore';
export type {
	SandboxJobPayload,
	SandboxJobResult,
	SandboxJobStatus,
	SandboxJobAction,
} from './jobTypes';
