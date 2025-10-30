// @ts-nocheck
import { getSandbox, parseSSEStream } from '@cloudflare/sandbox';
import type { Sandbox } from '@cloudflare/sandbox';

type SandboxEnv = Record<string, unknown> & { Sandbox?: unknown };

type SandboxNamespace = {
	get(id: unknown): unknown;
};

export function createCloudflareSandbox(env: SandboxEnv, sandboxId: string): Sandbox<unknown> {
	const namespace = env.Sandbox as SandboxNamespace;
	return getSandbox(namespace as any, sandboxId) as unknown as Sandbox<unknown>;
}

export { parseSSEStream };
