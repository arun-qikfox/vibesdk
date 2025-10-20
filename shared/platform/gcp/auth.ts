const METADATA_TOKEN_ENDPOINT =
	'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';

type EnvLike = Record<string, unknown> | undefined | null;

let cachedToken: { token: string; expiry: number } | null = null;

export function readEnvValue(env: EnvLike, key: string): string | undefined {
	if (env && typeof env === 'object' && key in env) {
		const value = (env as Record<string, unknown>)[key];
		if (typeof value === 'string' && value.trim().length > 0) {
			return value;
		}
	}
	if (typeof process !== 'undefined' && process.env && key in process.env) {
		const value = process.env[key];
		if (value && value.trim().length > 0) {
			return value;
		}
	}
	return undefined;
}

async function fetchMetadataToken(): Promise<{ token: string; expiry: number }> {
	const response = await fetch(METADATA_TOKEN_ENDPOINT, {
		headers: { 'Metadata-Flavor': 'Google' },
	});
	if (!response.ok) {
		throw new Error(
			`Failed to retrieve access token from metadata server (status ${response.status})`,
		);
	}
	const payload = (await response.json()) as {
		access_token: string;
		expires_in: number;
	};
	return {
		token: payload.access_token,
		expiry: Date.now() + payload.expires_in * 1000,
	};
}

export async function getAccessToken(env: EnvLike): Promise<string> {
	const explicitToken = readEnvValue(env, 'GCP_ACCESS_TOKEN');
	if (explicitToken) {
		return explicitToken;
	}
	if (cachedToken && cachedToken.expiry - 60_000 > Date.now()) {
		return cachedToken.token;
	}
	try {
		const token = await fetchMetadataToken();
		cachedToken = token;
		return token.token;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(
			`Unable to acquire Google access token. Set GCP_ACCESS_TOKEN when running outside GCP (message: ${message})`,
		);
	}
}

export function getProjectId(env: EnvLike): string | undefined {
	return (
		readEnvValue(env, 'GCP_PROJECT_ID') ||
		readEnvValue(env, 'GOOGLE_CLOUD_PROJECT') ||
		readEnvValue(env, 'GCLOUD_PROJECT')
	);
}
