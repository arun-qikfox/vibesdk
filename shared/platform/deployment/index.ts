import * as cloudflareDeployment from 'worker/services/deployer/deploy';
import { getRuntimeProvider } from 'shared/platform/runtimeProvider';

export interface DeploymentAdapter {
    buildDeploymentConfig: typeof cloudflareDeployment.buildDeploymentConfig;
    parseWranglerConfig: typeof cloudflareDeployment.parseWranglerConfig;
    deployWorker: typeof cloudflareDeployment.deployWorker;
    deployToDispatch: typeof cloudflareDeployment.deployToDispatch;
}

export function getDeploymentAdapter(env?: unknown): DeploymentAdapter {
    const provider = getRuntimeProvider(env);
    if (provider !== 'cloudflare') {
        throw new Error('Deployment adapter is not implemented for provider "' + provider + '".');
    }
    return {
        buildDeploymentConfig: cloudflareDeployment.buildDeploymentConfig,
        parseWranglerConfig: cloudflareDeployment.parseWranglerConfig,
        deployWorker: cloudflareDeployment.deployWorker,
        deployToDispatch: cloudflareDeployment.deployToDispatch,
    };
}
