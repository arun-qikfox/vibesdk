const METADATA_TOKEN_ENDPOINT =
	'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';

const DEFAULT_SCOPES = ['https://www.googleapis.com/auth/cloud-platform'];

type EnvLike = Record<string, unknown> | undefined | null;

let cachedToken: { token: string; expiry: number } | null = null;
let googleAuthPromise:
	| Promise<import('google-auth-library').GoogleAuth | null>
	| null = null;

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

async function getGoogleAuth(scopes: string[] = DEFAULT_SCOPES) {
	if (googleAuthPromise) {
		return googleAuthPromise;
	}
	if (typeof process === 'undefined') {
		googleAuthPromise = Promise.resolve(null);
		return googleAuthPromise;
	}
	try {
		googleAuthPromise = import('google-auth-library').then(
			({ GoogleAuth }) => new GoogleAuth({ scopes }),
		);
	} catch (error) {
		console.warn(
			'[GCP Auth] google-auth-library could not be imported. Application Default Credentials will be unavailable.',
			error,
		);
		googleAuthPromise = Promise.resolve(null);
	}
	return googleAuthPromise;
}

function rememberToken(token: string, expiry?: number | null) {
	const safeExpiry =
		typeof expiry === 'number' && Number.isFinite(expiry)
			? expiry
			: Date.now() + 50 * 60_000; // default 50 minutes
	cachedToken = { token, expiry: safeExpiry };
	return token;
}

export async function getAccessToken(
	env: EnvLike,
	scopes: string[] = DEFAULT_SCOPES,
): Promise<string> {
	const explicitToken = readEnvValue(env, 'GCP_ACCESS_TOKEN');
	if (explicitToken) {
		return rememberToken(explicitToken, Date.now() + 5 * 60_000);
	}
	if (cachedToken && cachedToken.expiry - 60_000 > Date.now()) {
		return cachedToken.token;
	}

	let lastError: unknown = null;

	const googleAuth = await getGoogleAuth(scopes);
	if (googleAuth) {
		try {
			const client = await googleAuth.getClient();
			const accessToken = await client.getAccessToken();
			const credentials =
				(client as unknown as { credentials?: { expiry_date?: number } })
					.credentials;
			if (typeof accessToken === 'string' && accessToken.trim().length > 0) {
				const expiry = credentials?.expiry_date;
				return rememberToken(accessToken, expiry ?? null);
			}
			if (accessToken && typeof accessToken === 'object' && 'token' in accessToken) {
				const tokenValue = (accessToken as { token?: string }).token;
				if (tokenValue && tokenValue.trim().length > 0) {
					const expiry = credentials?.expiry_date;
					return rememberToken(tokenValue, expiry ?? null);
				}
			}
		} catch (error) {
			lastError = error;
		}
	}

	try {
		const token = await fetchMetadataToken();
		return rememberToken(token.token, token.expiry);
	} catch (error) {
		const messages: string[] = [];
		const metadataMessage = error instanceof Error ? error.message : String(error);
		messages.push(metadataMessage);
		if (lastError) {
			const adcMessage =
				lastError instanceof Error ? lastError.message : String(lastError);
			messages.push(`ADC: ${adcMessage}`);
		}

		const hints = [
			'Set GCP_ACCESS_TOKEN with a valid bearer token',
			'Provide GOOGLE_APPLICATION_CREDENTIALS pointing to a service account JSON',
			'Run `gcloud auth application-default login` to provision local ADC credentials',
		].join('; ');

		throw new Error(
			`Unable to acquire Google access token. Attempts failed: ${messages.join(
				' | ',
			)}. ${hints}.`,
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
