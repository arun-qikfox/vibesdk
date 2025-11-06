export type DeploymentTarget = 'cloudflare' | 'app_engine';

export interface DeploymentConfig {
	target: DeploymentTarget;
	isStaticFrontend: boolean; // Phase 1: static frontend only, Phase 2+: can be false if backend detected
	hasBackend?: boolean; // Phase 2: indicates if backend API is present
}

export function getDeploymentConfig(env: Env): DeploymentConfig {
	// Default to App Engine for frontend-only deployments
	const target = (env.DEFAULT_DEPLOYMENT_TARGET || 'app_engine') as DeploymentTarget;

	return {
		target,
		isStaticFrontend: true, // Phase 1: static frontend only
	};
}

