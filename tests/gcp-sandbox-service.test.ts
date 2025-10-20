import { beforeEach, describe, expect, it, vi } from 'vitest';

const runMock = vi.fn();
const markStatusMock = vi.fn();
const getRecordMock = vi.fn();

vi.mock('shared/platform/sandbox', () => ({
	getSandboxExecutor: () => ({
		run: runMock,
	}),
	FirestoreSandboxRunStore: class {
		constructor() {}
		markStatus = (...args: any[]) => {
			const result = markStatusMock(...args);
			return result instanceof Promise ? result : Promise.resolve(result);
		};
		get = (...args: any[]) => {
			const result = getRecordMock(...args);
			return result instanceof Promise ? result : Promise.resolve(result);
		};
	},
}));

import { GcpSandboxService } from '../worker/services/sandbox/gcpSandboxService';

const baseEnv = {
	RUNTIME_PROVIDER: 'gcp',
	SANDBOX_TOPIC: 'sandbox-requests',
	SANDBOX_JOB_NAME: 'sandbox-job',
	GCP_PROJECT_ID: 'demo-project',
	GCP_REGION: 'us-central1',
	GCP_ACCESS_TOKEN: 'token',
} as unknown as Env;

describe('GcpSandboxService', () => {
	beforeEach(() => {
		runMock.mockReset();
		markStatusMock.mockReset();
		getRecordMock.mockReset();
		getRecordMock.mockResolvedValue(null);
	});

	it('dispatches createInstance action through the executor', async () => {
		runMock.mockResolvedValue({ success: true, logs: 'queued' });

		const service = new GcpSandboxService(baseEnv, 'session-1', 'agent-1');
		const result = await service.createInstance(
			'template-A',
			'project-alpha',
			'https://example.com/hook',
		);

		expect(runMock).toHaveBeenCalledTimes(1);
	expect(runMock).toHaveBeenCalledWith(
		expect.objectContaining({
			sessionId: 'session-1',
			agentId: 'agent-1',
			templateName: 'template-A',
			projectName: 'project-alpha',
			action: 'createInstance',
			params: expect.objectContaining({
				templateName: 'template-A',
				projectName: 'project-alpha',
				webhookUrl: 'https://example.com/hook',
			}),
		}),
		);

		expect(result.success).toBe(true);
		expect(result.runId).toBe('session-1');
		expect(result.message).toContain('queued');
		expect(markStatusMock).toHaveBeenCalledWith('session-1', 'createInstance', 'queued', {
			message: 'Sandbox job dispatched to Cloud Run',
		});
	});

	it('returns an error when executor fails', async () => {
		runMock.mockResolvedValue({ success: false, error: 'boom' });

		const service = new GcpSandboxService(baseEnv, 'session-2', 'agent-9');
		const result = await service.createInstance('template-B', 'project-beta');

		expect(result.success).toBe(false);
		expect(result.error).toBe('boom');
		expect(markStatusMock).toHaveBeenCalledWith('session-2', 'createInstance', 'failed', {
			error: 'boom',
		});
	});

	it('reads sandbox status from Firestore store', async () => {
		getRecordMock.mockResolvedValue({
			sessionId: 'session-status',
			action: 'createInstance',
			status: 'succeeded',
			updatedAt: new Date().toISOString(),
			message: 'done',
			output: {
				previewURL: 'https://example.dev',
				processId: 'pid-123',
			},
		});

		const service = new GcpSandboxService(baseEnv, 'session-status', 'agent-status');
		const status = await service.getInstanceStatus('session-status');
		expect(status.success).toBe(true);
		expect(status.pending).toBe(false);
		expect(status.isHealthy).toBe(true);
		expect(status.previewURL).toBe('https://example.dev');
		expect(status.processId).toBe('pid-123');
	});
});
