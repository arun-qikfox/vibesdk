export type DeploymentTarget = 'cloudflare' | 'app_engine';

export interface DeploymentConfig {
	target: DeploymentTarget;
	isStaticFrontend: boolean; // For Phase 1, always true
}

export function getDeploymentConfig(env: Env): DeploymentConfig {
	// Default to App Engine for frontend-only deployments
	const target = (env.DEFAULT_DEPLOYMENT_TARGET || 'app_engine') as DeploymentTarget;

	return {
		target,
		isStaticFrontend: true, // Phase 1: static frontend only
	};
}

