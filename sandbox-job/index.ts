import { FirestoreSandboxRunStore } from '../shared/platform/sandbox/gcpRunStore';
import type { SandboxJobPayload } from '../shared/platform/sandbox/jobTypes';
import { getAccessToken, getProjectId, readEnvValue } from '../shared/platform/gcp/auth';

type EnvRecord = Record<string, unknown>;

const PUBSUB_ENDPOINT = 'https://pubsub.googleapis.com/v1';

function getSubscription(env: EnvRecord): string {
	const value =
		(typeof env.SANDBOX_SUBSCRIPTION === 'string' && env.SANDBOX_SUBSCRIPTION.trim().length > 0
			? env.SANDBOX_SUBSCRIPTION.trim()
			: process.env.SANDBOX_SUBSCRIPTION) ?? '';
	if (!value) {
		throw new Error('SANDBOX_SUBSCRIPTION environment variable is required.');
	}
	if (value.startsWith('projects/')) {
		return value;
	}
	const projectId =
		readEnvValue(env, 'GCP_PROJECT_ID') ||
		process.env.GCP_PROJECT_ID ||
		process.env.GOOGLE_CLOUD_PROJECT ||
		process.env.GCLOUD_PROJECT;
	if (!projectId) {
		throw new Error('GCP project ID is required to build subscription path.');
	}
	return `projects/${projectId}/subscriptions/${value}`;
}

async function pullMessage(env: EnvRecord): Promise<{
	data: SandboxJobPayload;
	ackId: string;
}> {
	const projectId = getProjectId(env);
	if (!projectId) {
		throw new Error('GCP project ID is not configured.');
	}
	const subscription = getSubscription(env);
	const url = `${PUBSUB_ENDPOINT}/${subscription}:pull`;
	const token = await getAccessToken(env);

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ maxMessages: 1 }),
	});
	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Failed to pull Pub/Sub message (${response.status}): ${text}`);
	}

	const payload = (await response.json()) as {
		receivedMessages?: Array<{
			ackId: string;
			message?: { data?: string };
		}>;
	};

	const received = payload.receivedMessages?.[0];
	if (!received?.message?.data) {
		throw new Error('No sandbox messages available in subscription.');
	}

	const decoded = Buffer.from(received.message.data, 'base64').toString('utf8');
	const data = JSON.parse(decoded) as SandboxJobPayload;
	return { data, ackId: received.ackId };
}

async function ackMessage(env: EnvRecord, ackId: string): Promise<void> {
	const subscription = getSubscription(env);
	const token = await getAccessToken(env);
	const url = `${PUBSUB_ENDPOINT}/${subscription}:acknowledge`;
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ ackIds: [ackId] }),
	});
	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Failed to acknowledge Pub/Sub message (${response.status}): ${text}`);
	}
}

async function main(): Promise<void> {
	const env = Object.assign({}, process.env) as EnvRecord;
	const store = new FirestoreSandboxRunStore(env);

	try {
		const { data, ackId } = await pullMessage(env);

		await store
			.markStatus(data.sessionId, data.action, 'running', {
				message: 'Sandbox job execution started.',
			})
			.catch(() => undefined);

		// TODO: Implement sandbox container orchestration here.
		const message = `Sandbox action "${data.action}" executed (stub).`;
		await store
			.markStatus(data.sessionId, data.action, 'succeeded', {
				message,
				output: {
					action: data.action,
					templateName: data.templateName,
					projectName: data.projectName,
					params: data.params,
					note: 'Execution stubbed; replace with real implementation.',
				},
			})
			.catch(() => undefined);

		await ackMessage(env, ackId).catch((error) => {
			console.error('Failed to acknowledge Pub/Sub message', error);
		});
		console.log(message);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error('Sandbox job handler encountered an error:', message);
		throw error;
	}
}

main().catch((error) => {
	console.error('Sandbox job failed:', error);
	process.exitCode = 1;
});
