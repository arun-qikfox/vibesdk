import { fetchSecret } from 'shared/platform/secrets';
import { getRuntimeProvider } from 'shared/platform/runtimeProvider';

const REQUIRED_SECRETS = [
	'JWT_SECRET',
	'SECRETS_ENCRYPTION_KEY',
	'WEBHOOK_SECRET',
	'AI_PROXY_JWT_SECRET',
	'GOOGLE_AI_STUDIO_API_KEY',
] as const;

type SecretKey = (typeof REQUIRED_SECRETS)[number];

function getEnvRecord(env: Env): Record<string, unknown> {
	return env as unknown as Record<string, unknown>;
}

function getEnvStringRecord(env: Env): Record<string, string> {
	return env as unknown as Record<string, string>;
}

function hasValue(env: Env, key: SecretKey): boolean {
	const envRecord = getEnvRecord(env);
	const value = envRecord[key];
	return typeof value === 'string' && value.trim().length > 0;
}

export async function ensureSecrets(env: Env): Promise<void> {
	if (getRuntimeProvider(env) !== 'gcp') {
		return;
	}

	await Promise.all(
		REQUIRED_SECRETS.map(async (key) => {
			if (hasValue(env, key)) {
				return;
			}
			try {
				const secret = await fetchSecret(env as unknown as Record<string, unknown>, key);
				if (secret) {
					const envRecord = getEnvStringRecord(env);
					envRecord[key] = secret;
				} else {
					console.warn(`Secret "${key}" not found in Secret Manager.`);
				}
			} catch (error) {
				console.error(`Failed to load secret "${key}" from Secret Manager`, error);
			}
		}),
	);
}
