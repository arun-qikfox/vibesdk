import { getSandbox, parseSSEStream } from '@cloudflare/sandbox';
import type { Sandbox } from '@cloudflare/sandbox';

export function createCloudflareSandbox(env: Env, sandboxId: string): Sandbox<Env> {
	return getSandbox(env.Sandbox, sandboxId);
}

export { parseSSEStream };
