import { getRuntimeProvider } from 'shared/platform/runtimeProvider';

export { getSandbox, parseSSEStream } from '@cloudflare/sandbox';
export type { ExecuteResponse, LogEvent, Sandbox } from '@cloudflare/sandbox';

export function assertSandboxProvider(env?: unknown): void {
    const provider = getRuntimeProvider(env);
    if (provider !== 'cloudflare') {
        throw new Error('Sandbox runtime is not implemented for provider "' + provider + '".');
    }
}
