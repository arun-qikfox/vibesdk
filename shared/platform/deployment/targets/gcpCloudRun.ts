import type { DeploymentInput, DeploymentStatus, DeploymentTarget } from '../index';

type EnvLike = Record<string, unknown> | undefined | null;

export function createGcpCloudRunTarget(_env: EnvLike): DeploymentTarget {
	return {
		id: 'gcp-cloud-run',
		async deploy(_input: DeploymentInput) {
			throw new Error('GCP Cloud Run deployment is not implemented yet.');
		},
		async remove(_appId: string): Promise<void> {
			throw new Error('GCP Cloud Run removal is not implemented yet.');
		},
		async status(_appId: string): Promise<DeploymentStatus> {
			return {
				state: 'unknown',
				message: 'GCP Cloud Run status checks are not implemented yet.',
			};
		},
	};
}
