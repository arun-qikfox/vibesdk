import type { DeploymentInput, DeploymentStatus, DeploymentTarget } from '../index';

import type { DispatchDeployConfig, WranglerConfig } from 'worker/services/deployer/types';
import { deployToDispatch } from 'worker/services/deployer/deploy';

type EnvLike = Record<string, unknown> | undefined | null;

type CloudflareDeploymentPayload = {
	deployConfig: DispatchDeployConfig;
	fileContents?: Map<string, Buffer>;
	additionalModules?: Map<string, string>;
	migrations?: WranglerConfig['migrations'];
	assetsConfig?: WranglerConfig['assets'];
	previewDomain: string;
	protocol: string;
};

function assertCloudflarePayload(payload: unknown): CloudflareDeploymentPayload {
	if (!payload || typeof payload !== 'object') {
		throw new Error('Cloudflare deployment payload is missing.');
	}
	const record = payload as Record<string, unknown>;
	if (!record.deployConfig || typeof record.deployConfig !== 'object') {
		throw new Error('Cloudflare deployment payload is missing deployConfig.');
	}
	if (typeof record.previewDomain !== 'string' || record.previewDomain.trim() === '') {
		throw new Error('Cloudflare deployment payload is missing previewDomain.');
	}
	if (typeof record.protocol !== 'string' || record.protocol.trim() === '') {
		throw new Error('Cloudflare deployment payload is missing protocol.');
	}
	return record as CloudflareDeploymentPayload;
}

export function createCloudflareWorkersTarget(_env: EnvLike): DeploymentTarget {
	return {
		id: 'cloudflare-workers',
		async deploy(input: DeploymentInput) {
			const payload = assertCloudflarePayload(input.payload);
			await deployToDispatch(
				payload.deployConfig,
				payload.fileContents,
				payload.additionalModules,
				payload.migrations,
				payload.assetsConfig,
			);

			const deployedUrl = `${payload.protocol}://${input.projectName}.${payload.previewDomain}`;

			return {
				success: true,
				message: `Successfully deployed ${input.projectName} to Cloudflare Workers.`,
				deployedUrl,
				deploymentId: input.projectName,
				output: 'Deployed',
			};
		},
		async remove(_appId: string): Promise<void> {
			throw new Error('Removal is not yet implemented for the Cloudflare deployment target.');
		},
		async status(_appId: string): Promise<DeploymentStatus> {
			return {
				state: 'unknown',
				message: 'Status checks are not implemented for the Cloudflare deployment target.',
			};
		},
	};
}
