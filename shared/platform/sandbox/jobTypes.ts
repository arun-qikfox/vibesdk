export type SandboxJobAction =
	| 'initialize'
	| 'getTemplateDetails'
	| 'createInstance'
	| 'listAllInstances'
	| 'getInstanceDetails'
	| 'getInstanceStatus'
	| 'shutdownInstance'
	| 'writeFiles'
	| 'getFiles'
	| 'executeCommands'
	| 'getInstanceErrors'
	| 'clearInstanceErrors'
	| 'runStaticAnalysisCode'
	| 'deployInstance'
	| 'getLogs'
	| 'clearLogs'
	| 'deployToCloudflareWorkers'
	| 'pushToGitHub';

export type SandboxJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface SandboxJobPayload {
	sessionId: string;
	agentId: string;
	templateName: string;
	projectName: string;
	action: SandboxJobAction;
	issuedAt: string;
	params?: Record<string, unknown>;
}

export interface SandboxJobResult {
	sessionId: string;
	action: SandboxJobAction;
	status: SandboxJobStatus;
	message?: string;
	error?: string;
	logs?: string[];
	output?: unknown;
	updatedAt: string;
}
