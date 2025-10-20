import { getRuntimeProvider } from 'shared/platform/runtimeProvider';
import { accessSecret } from './gcpSecretManager';

type EnvLike = Record<string, unknown> | undefined | null;

export async function fetchSecret(
	env: EnvLike,
	secretId: string,
	version = 'latest',
): Promise<string | null> {
	const provider = getRuntimeProvider(env);
	if (provider === 'gcp') {
		return accessSecret(env, secretId, version);
	}
	// On Cloudflare secrets are provided as Env bindings already.
	return null;
}

export { accessSecret } from './gcpSecretManager';
