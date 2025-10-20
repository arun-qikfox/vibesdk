import { getAccessToken, getProjectId } from '../gcp/auth';

type EnvLike = Record<string, unknown> | undefined | null;

const SECRET_MANAGER_BASE = 'https://secretmanager.googleapis.com/v1';

interface AccessSecretResponse {
	payload?: {
		data?: string;
	};
}

function decodePayload(data: string): string {
	if (typeof atob === 'function') {
		return atob(data);
	}
	return Buffer.from(data, 'base64').toString('utf-8');
}

export async function accessSecret(
	env: EnvLike,
	secretId: string,
	version = 'latest',
): Promise<string | null> {
	const projectId = getProjectId(env);
	if (!projectId) {
		throw new Error(
			'GCP_PROJECT_ID is not configured. Set this environment variable to access Secret Manager.',
		);
	}

	const token = await getAccessToken(env);
	const name = `projects/${projectId}/secrets/${secretId}/versions/${version}:access`;
	const url = `${SECRET_MANAGER_BASE}/${name}`;

	const response = await fetch(url, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/json',
		},
	});

	if (response.status === 404) {
		return null;
	}

	if (!response.ok) {
		const message = await response.text();
		throw new Error(
			`Failed to access secret "${secretId}" (status ${response.status}): ${message}`,
		);
}

	const data = (await response.json()) as AccessSecretResponse;
	const encoded = data.payload?.data;
	if (!encoded) {
		return null;
	}
	return decodePayload(encoded);
}
