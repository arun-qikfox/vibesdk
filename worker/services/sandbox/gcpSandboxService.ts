import {
	getSandboxExecutor,
	FirestoreSandboxRunStore,
	type SandboxExecutor,
	type SandboxResult,
	type SandboxJobAction,
} from 'shared/platform/sandbox';
import type {
	BootstrapResponse,
	BootstrapStatusResponse,
	ClearErrorsResponse,
	DeploymentResult,
	ExecuteCommandsResponse,
	GetFilesResponse,
	GetInstanceResponse,
	GetLogsResponse,
	GitHubPushRequest,
	GitHubPushResponse,
	ListInstancesResponse,
	RuntimeErrorResponse,
	StaticAnalysisResponse,
	TemplateDetailsResponse,
	WriteFilesRequest,
	WriteFilesResponse,
} from './sandboxTypes';
import { BaseSandboxService } from './BaseSandboxService';
import type { FileOutputType } from 'worker/agents/schemas';

type DispatchPayload = Record<string, unknown>;

export class GcpSandboxService extends BaseSandboxService {
	private readonly env: Env;
	private readonly agentId: string;
	private readonly executor: SandboxExecutor;
 	private readonly store: FirestoreSandboxRunStore;

	constructor(env: Env, sessionId: string, agentId: string) {
		super(sessionId);
		this.env = env;
		this.agentId = agentId;
		this.executor = getSandboxExecutor(env as any);
		this.store = new FirestoreSandboxRunStore(env as any);

		this.logger.setFields({
			provider: 'gcp',
			sandboxId: this.sandboxId,
			agentId,
		});
	}

	private async dispatch(
		action: SandboxJobAction,
		payload: DispatchPayload = {},
	): Promise<SandboxResult> {
		const templateName =
			typeof payload.templateName === 'string' ? payload.templateName : '';
		const projectName =
			typeof payload.projectName === 'string' ? payload.projectName : '';

		try {
			await this.store
				.markStatus(this.sandboxId, action, 'queued', {
					message: 'Sandbox job dispatched to Cloud Run',
				})
				.catch(() => undefined);

			const result = await this.executor.run({
				sessionId: this.sandboxId,
				agentId: this.agentId,
				templateName,
				projectName,
				action,
				params: payload,
			});

			if (!result.success) {
				this.logger.warn('Sandbox executor returned an error', {
					action,
					error: result.error,
				});
				await this.store
					.markStatus(this.sandboxId, action, 'failed', {
						error: result.error ?? 'Sandbox executor dispatch failed',
					})
					.catch(() => undefined);
			} else {
				this.logger.info('Sandbox job dispatched', {
					action,
					logs: result.logs,
				});
			}
			return result;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.error('Failed to dispatch sandbox action', {
				action,
				error: message,
			});
			await this.store
				.markStatus(this.sandboxId, action, 'failed', {
					error: message,
				})
				.catch(() => undefined);
			return {
				success: false,
				error: message,
			};
		}
	}

	private operationUnavailable<T extends { success: boolean; error?: string }>(
		action: string,
	): T {
		const message = `${action} is not yet implemented for the GCP sandbox runtime.`;
		this.logger.warn(message);
		return {
			success: false,
			error: message,
		} as T;
	}

	async initialize(): Promise<void> {
		await this.dispatch('initialize');
	}

	async getTemplateDetails(templateName: string): Promise<TemplateDetailsResponse> {
		await this.dispatch('getTemplateDetails', { templateName });
		return { success: false, error: 'Operation unavailable' };
	}

	async createInstance(
		templateName: string,
		projectName: string,
		webhookUrl?: string,
		localEnvVars?: Record<string, string>,
	): Promise<BootstrapResponse> {
		const result = await this.dispatch('createInstance', {
			templateName,
			projectName,
			webhookUrl,
			localEnvVars,
		});

		if (!result.success) {
			return {
				success: false,
				error: result.error ?? 'Failed to dispatch sandbox job.',
			};
		}

		return {
			success: true,
			runId: this.sandboxId,
			message:
				result.logs ??
				'Sandbox job dispatched. Result retrieval is handled asynchronously.',
		};
	}

	async listAllInstances(): Promise<ListInstancesResponse> {
		await this.dispatch('listAllInstances');
		return { success: false, error: 'Operation unavailable' };
	}

	async getInstanceDetails(instanceId: string): Promise<GetInstanceResponse> {
		await this.dispatch('getInstanceDetails', { instanceId });
		return { success: false, error: 'Operation unavailable' };
	}

	async getInstanceStatus(instanceId: string): Promise<BootstrapStatusResponse> {
		try {
			const record = await this.store.get(instanceId);
			if (!record) {
				return {
					success: true,
					pending: true,
					isHealthy: false,
					message: 'Sandbox job has not reported status yet.',
				};
			}

			if (record.status === 'failed') {
				return {
					success: false,
					pending: false,
					isHealthy: false,
					error: record.error ?? record.message ?? 'Sandbox job failed.',
				};
			}

			if (record.status === 'succeeded') {
				const output = (record.output ?? {}) as Record<string, unknown>;
				return {
					success: true,
					pending: false,
					isHealthy: true,
					message: record.message ?? 'Sandbox job completed.',
					previewURL: typeof output.previewURL === 'string' ? (output.previewURL as string) : undefined,
					tunnelURL: typeof output.tunnelURL === 'string' ? (output.tunnelURL as string) : undefined,
					processId: typeof output.processId === 'string' ? (output.processId as string) : undefined,
				};
			}

			return {
				success: true,
				pending: true,
				isHealthy: false,
				message: record.message ?? 'Sandbox job is still running.',
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				pending: false,
				isHealthy: false,
				error: message,
			};
		}
	}

	async shutdownInstance(instanceId: string): Promise<BootstrapResponse> {
		const result = await this.dispatch('shutdownInstance', { instanceId });
		if (!result.success) {
			return {
				success: false,
				error: result.error ?? 'Failed to dispatch sandbox shutdown job.',
			};
		}

		return {
			success: true,
			runId: instanceId,
			message:
				result.logs ??
				'Sandbox shutdown job dispatched. Cleanup runs asynchronously.',
		};
	}

	async writeFiles(
		instanceId: string,
		files: WriteFilesRequest['files'],
		commitMessage?: string,
	): Promise<WriteFilesResponse> {
		await this.dispatch('writeFiles', { instanceId, files, commitMessage });
		return { success: false, error: 'Operation unavailable' };
	}

	async getFiles(
		instanceId: string,
		filePaths?: string[],
		isTemplate?: boolean,
		redactedFiles?: string[],
	): Promise<GetFilesResponse> {
		await this.dispatch('getFiles', {
			instanceId,
			filePaths,
			isTemplate,
			redactedFiles,
		});
		return { success: false, error: 'Operation unavailable' };
	}

	async executeCommands(
		instanceId: string,
		commands: string[],
		timeout?: number,
	): Promise<ExecuteCommandsResponse> {
		await this.dispatch('executeCommands', { instanceId, commands, timeout });
		return { success: false, error: 'Operation unavailable' };
	}

	async getInstanceErrors(instanceId: string): Promise<RuntimeErrorResponse> {
		await this.dispatch('getInstanceErrors', { instanceId });
		return { success: false, error: 'Operation unavailable' };
	}

	async clearInstanceErrors(instanceId: string): Promise<ClearErrorsResponse> {
		await this.dispatch('clearInstanceErrors', { instanceId });
		return { success: false, error: 'Operation unavailable' };
	}

	async runStaticAnalysisCode(
		instanceId: string,
		lintFiles?: string[],
	): Promise<StaticAnalysisResponse> {
		await this.dispatch('runStaticAnalysisCode', { instanceId, lintFiles });
		return { success: false, error: 'Operation unavailable' };
	}

	async deployInstance(
		instanceId: string,
		target: 'cloudflare' | 'gcp',
		options: Record<string, unknown>,
	): Promise<DeploymentResult> {
		await this.dispatch('deployInstance', { instanceId, target, options });
		return { success: false, error: 'Operation unavailable' };
	}

	async getLogs(instanceId: string): Promise<GetLogsResponse> {
		try {
			const record = await this.store.get(instanceId);
			const logs = record?.logs ?? [];
			return {
				success: true,
				logs: {
					stdout: logs.join('\n'),
					stderr: '',
				},
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				logs: {
					stdout: '',
					stderr: '',
				},
				error: message,
			};
		}
	}

	async clearLogs(instanceId: string): Promise<GetLogsResponse> {
		await this.dispatch('clearLogs', { instanceId });
		return { success: false, error: 'Operation unavailable' };
	}

async deployToCloudflareWorkers(instanceId: string): Promise<DeploymentResult> {
	await this.dispatch('deployToCloudflareWorkers', { instanceId });
	return { success: false, error: 'Operation unavailable' };
}

async pushToGitHub(
	instanceId: string,
	request: GitHubPushRequest,
	files: FileOutputType[],
): Promise<GitHubPushResponse> {
	await this.dispatch('pushToGitHub', { instanceId, request, files });
	return { success: false, error: 'Operation unavailable' };
}

}
