import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createGcpSandboxExecutor,
	type SandboxExecutionRequest,
} from '../shared/platform/sandbox/gcpSandbox';

const originalFetch = globalThis.fetch;

describe('GCP sandbox executor', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it('publishes a sandbox request and triggers the Cloud Run job', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ messageIds: ['msg-123'] }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				}),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ name: 'operations/456' }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				}),
			);

		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const env = {
			GCP_PROJECT_ID: 'demo-project',
			GCP_REGION: 'us-central1',
			SANDBOX_TOPIC: 'sandbox-requests',
			SANDBOX_JOB_NAME: 'sandbox-job',
			GCP_ACCESS_TOKEN: 'test-token',
		} satisfies Record<string, string>;

		const executor = createGcpSandboxExecutor(env);
		const request: SandboxExecutionRequest = {
			sessionId: 'session-001',
			agentId: 'agent-01',
			templateName: 'react-app',
			projectName: 'demo-app',
			action: 'createInstance',
			params: { foo: 'bar' },
		};

		const result = await executor.run(request);
		expect(result.success).toBe(true);

		expect(fetchMock).toHaveBeenCalledTimes(2);

		const publishCall = fetchMock.mock.calls[0];
		expect(publishCall[0]).toBe(
			'https://pubsub.googleapis.com/v1/projects/demo-project/topics/sandbox-requests:publish',
		);

		const publishBody = JSON.parse(publishCall[1]?.body as string);
		expect(publishBody.messages).toHaveLength(1);
		expect(publishBody.messages[0].attributes).toMatchObject({
			sessionId: 'session-001',
			agentId: 'agent-01',
			templateName: 'react-app',
			projectName: 'demo-app',
		});

		const decodedPayload = Buffer.from(
			publishBody.messages[0].data,
			'base64',
		).toString('utf8');
		const parsedPayload = JSON.parse(decodedPayload);
		expect(parsedPayload).toMatchObject({
			sessionId: 'session-001',
			action: 'createInstance',
			agentId: 'agent-01',
			params: { foo: 'bar' },
		});

		const jobCall = fetchMock.mock.calls[1];
		expect(jobCall[0]).toBe(
			'https://run.googleapis.com/v2/projects/demo-project/locations/us-central1/jobs/sandbox-job:run',
		);

		const jobBody = JSON.parse(jobCall[1]?.body as string);
		const envOverrides = jobBody.overrides.containerOverrides[0].env;
		expect(envOverrides).toEqual(
			expect.arrayContaining([
				{ name: 'SANDBOX_MESSAGE_ID', value: 'msg-123' },
				{ name: 'SANDBOX_SESSION_ID', value: 'session-001' },
				{ name: 'SANDBOX_AGENT_ID', value: 'agent-01' },
				{ name: 'SANDBOX_TEMPLATE_NAME', value: 'react-app' },
				{ name: 'SANDBOX_PROJECT_NAME', value: 'demo-app' },
			]),
		);
	});

	it('returns an error result when SANDBOX_TOPIC is missing', async () => {
		const env = {
			GCP_PROJECT_ID: 'demo-project',
			GCP_REGION: 'us-central1',
			SANDBOX_JOB_NAME: 'sandbox-job',
			GCP_ACCESS_TOKEN: 'test-token',
		} satisfies Record<string, string>;

		const executor = createGcpSandboxExecutor(env);
		const result = await executor.run({
			sessionId: 'session-002',
			agentId: 'agent-02',
			templateName: 'template',
			projectName: 'project',
			action: 'createInstance',
			params: {},
		});

		expect(result.success).toBe(false);
		expect(result.error).toMatch(/SANDBOX_TOPIC/);
	});
});
