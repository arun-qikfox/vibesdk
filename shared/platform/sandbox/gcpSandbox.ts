import { getAccessToken, getProjectId, readEnvValue } from '../gcp/auth';
import type { SandboxJobAction, SandboxJobPayload } from './jobTypes';

export interface SandboxExecutionRequest {
	sessionId: string;
	agentId: string;
	templateName: string;
	projectName: string;
	action: SandboxJobAction;
	params?: Record<string, unknown>;
}

export type SandboxResult = {
	success: boolean;
	logs?: string;
	error?: string;
};

export type SandboxExecutor = {
	run(request: SandboxExecutionRequest): Promise<SandboxResult>;
	getLogs?(sessionId: string): Promise<string[]>;
	cleanup?(sessionId: string): Promise<void>;
};

type EnvLike = Record<string, unknown> | undefined | null;

const PUBSUB_ENDPOINT = 'https://pubsub.googleapis.com/v1';
const CLOUD_RUN_JOBS_ENDPOINT = 'https://run.googleapis.com/v2';

function base64Encode(value: string): string {
	if (typeof btoa === 'function') {
		return btoa(value);
	}
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(value, 'utf8').toString('base64');
	}
	throw new Error('Base64 encoding is not supported in this environment.');
}

function safeStringify(value: unknown): string {
	try {
		return JSON.stringify(value);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return JSON.stringify({
			error: 'Failed to serialise payload',
			message,
		});
	}
}

function normaliseTopic(topic: string, projectId: string): string {
	const trimmed = topic.trim();
	if (trimmed.startsWith('projects/')) {
		return trimmed;
	}
	return `projects/${projectId}/topics/${trimmed}`;
}

function parseResponsePayload(text: string): unknown {
	if (!text) {
		return undefined;
	}
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

async function publishSandboxMessage(
	env: EnvLike,
	request: SandboxExecutionRequest,
): Promise<{ success: true; messageId: string } | SandboxResult> {
	const projectId = getProjectId(env);
	if (!projectId) {
		return {
			success: false,
			error:
				'GCP project ID is not configured. Set GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT.',
		};
	}

	const topic =
		readEnvValue(env, 'SANDBOX_TOPIC') ||
		readEnvValue(env, 'VIBESDK_SANDBOX_TOPIC');
	if (!topic) {
		return {
			success: false,
			error:
				'SANDBOX_TOPIC is not configured. Set SANDBOX_TOPIC to the Pub/Sub topic name.',
		};
	}

	const accessToken = await getAccessToken(env);
	const topicPath = normaliseTopic(topic, projectId);
	const publishUrl = `${PUBSUB_ENDPOINT}/${topicPath}:publish`;

	const payload: SandboxJobPayload = {
		sessionId: request.sessionId,
		agentId: request.agentId,
		templateName: request.templateName,
		projectName: request.projectName,
		action: request.action,
		params: request.params,
		issuedAt: new Date().toISOString(),
	};

	const body = {
		messages: [
			{
				data: base64Encode(safeStringify(payload)),
				attributes: {
					sessionId: request.sessionId,
					agentId: request.agentId,
					templateName: request.templateName,
					projectName: request.projectName,
					action: request.action,
				},
			},
		],
	};

	const response = await fetch(publishUrl, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${accessToken}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	});

	const responseText = await response.text();
	if (!response.ok) {
		const parsed = parseResponsePayload(responseText) as
			| { error?: { message?: string } }
			| string
			| undefined;
		const errorMessage =
			typeof parsed === 'string'
				? parsed
				: parsed && typeof parsed === 'object' && 'error' in parsed
					? parsed.error?.message
					: response.statusText || 'Unknown error';
		return {
			success: false,
			error: `Failed to publish sandbox request to Pub/Sub: ${errorMessage}`,
		};
	}

	const parsed = parseResponsePayload(responseText) as
		| { messageIds?: string[] }
		| undefined;
	const messageId = parsed?.messageIds?.[0];
	if (!messageId) {
		return {
			success: false,
			error:
				'Pub/Sub publish succeeded but no message ID was returned. Check topic configuration.',
		};
	}

	return { success: true, messageId };
}

async function triggerSandboxJob(
	env: EnvLike,
	request: SandboxExecutionRequest,
	messageId: string,
): Promise<SandboxResult> {
	const projectId = getProjectId(env);
	if (!projectId) {
		return {
			success: false,
			error:
				'GCP project ID is not configured. Set GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT.',
		};
	}

	const region = readEnvValue(env, 'GCP_REGION');
	if (!region) {
		return {
			success: false,
			error: 'GCP_REGION is not configured. Set GCP_REGION to the job region.',
		};
	}

	const jobName =
		readEnvValue(env, 'SANDBOX_JOB_NAME') ||
		readEnvValue(env, 'SANDBOX_JOB');
	if (!jobName) {
		return {
			success: false,
			error:
				'SANDBOX_JOB_NAME is not configured. Set SANDBOX_JOB_NAME to the Cloud Run job name.',
		};
	}

	const accessToken = await getAccessToken(env);
	const jobUrl = `${CLOUD_RUN_JOBS_ENDPOINT}/projects/${projectId}/locations/${region}/jobs/${jobName}:run`;

	const envOverrides = [
		{ name: 'SANDBOX_SESSION_ID', value: request.sessionId },
		{ name: 'SANDBOX_AGENT_ID', value: request.agentId },
		{ name: 'SANDBOX_TEMPLATE_NAME', value: request.templateName },
		{ name: 'SANDBOX_PROJECT_NAME', value: request.projectName },
		{ name: 'SANDBOX_MESSAGE_ID', value: messageId },
	].filter((item) => item.value && item.value.length > 0);

	const runBody = {
		overrides: {
			containerOverrides: [
				{
					env: envOverrides,
				},
			],
		},
	};

	const response = await fetch(jobUrl, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${accessToken}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(runBody),
	});

	const text = await response.text();
	if (!response.ok) {
		const parsed = parseResponsePayload(text) as
			| { error?: { message?: string } }
			| string
			| undefined;
		const errorMessage =
			typeof parsed === 'string'
				? parsed
				: parsed && typeof parsed === 'object' && 'error' in parsed
					? parsed.error?.message
					: response.statusText || 'Unknown error';
		return {
			success: false,
			error: `Failed to trigger Cloud Run sandbox job: ${errorMessage}`,
		};
	}

	return {
		success: true,
		logs: `Triggered sandbox job ${jobName} with message ${messageId}.`,
	};
}

export function createGcpSandboxExecutor(env?: EnvLike): SandboxExecutor {
	return {
		async run(request: SandboxExecutionRequest): Promise<SandboxResult> {
			const publishResult = await publishSandboxMessage(env, request);
			if (!publishResult.success) {
				return publishResult;
			}

			const jobResult = await triggerSandboxJob(env, request, publishResult.messageId);
			if (!jobResult.success) {
				return jobResult;
			}

			return {
				success: true,
				logs: `Published sandbox request ${publishResult.messageId} and triggered job.`,
			};
		},
	};
}
