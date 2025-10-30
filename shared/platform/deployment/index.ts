import * as cloudflareDeployment from 'worker/services/deployer/deploy';
import type { DeploymentResult } from 'worker/services/sandbox/sandboxTypes';

import { getRuntimeProvider } from 'shared/platform/runtimeProvider';

import { createCloudflareWorkersTarget } from './targets/cloudflareWorkers';
import { createGcpCloudRunTarget } from './targets/gcpCloudRun';

type EnvLike = Record<string, unknown> | undefined | null;

export type DeploymentTargetId = 'cloudflare-workers' | 'gcp-cloud-run';

export interface DeploymentStatus {
	state: 'unknown' | 'deploying' | 'active' | 'error';
	message?: string;
	url?: string;
	updatedAt?: string;
}

export interface DeploymentInput {
	env: EnvLike;
	instanceId: string;
	projectName: string;
	payload?: unknown;
}

export interface DeploymentTarget {
	id: DeploymentTargetId;
	deploy(input: DeploymentInput): Promise<DeploymentResult>;
	remove(appId: string, context?: DeploymentInput): Promise<void>;
	status(appId: string, context?: DeploymentInput): Promise<DeploymentStatus>;
}

type TargetFactory = (env: EnvLike) => DeploymentTarget;

const registry = new Map<DeploymentTargetId, TargetFactory>();

function normaliseTargetId(value?: string | null): DeploymentTargetId | null {
	if (!value) {
		return null;
	}
	const id = value.trim().toLowerCase();
	if (id === 'cloudflare-workers') {
		return 'cloudflare-workers';
	}
	if (id === 'gcp-cloud-run' || id === 'gcp' || id === 'cloud-run') {
		return 'gcp-cloud-run';
	}
	return null;
}

function readDefaultTarget(env: EnvLike): DeploymentTargetId {
	const fromEnv =
		(env &&
			typeof env === 'object' &&
			typeof (env as Record<string, unknown>).DEFAULT_DEPLOYMENT_TARGET === 'string'
			? ((env as Record<string, unknown>).DEFAULT_DEPLOYMENT_TARGET as string)
			: undefined) ||
		(typeof process !== 'undefined' &&
		process.env &&
		typeof process.env.DEFAULT_DEPLOYMENT_TARGET === 'string'
			? process.env.DEFAULT_DEPLOYMENT_TARGET
			: undefined);

	const normalised = normaliseTargetId(fromEnv ?? null);
	if (normalised) {
		return normalised;
	}

	// Default to GCP to drive Cloud Run deployments when unspecified.
	return 'gcp-cloud-run';
}

export function registerDeploymentTarget(id: DeploymentTargetId, factory: TargetFactory): void {
	registry.set(id, factory);
}

function toEnvLike(env: unknown): EnvLike {
	if (env && typeof env === 'object') {
		return env as Record<string, unknown>;
	}
	return null;
}

export function getDeploymentTarget(env: unknown, requestedId?: DeploymentTargetId): DeploymentTarget {
	const envLike = toEnvLike(env);
	const id = requestedId ?? readDefaultTarget(envLike);
	const factory = registry.get(id);
	if (!factory) {
		throw new Error(`Deployment target "${id}" is not registered.`);
	}
	return factory(envLike);
}

// Register built-in targets.
registerDeploymentTarget('cloudflare-workers', createCloudflareWorkersTarget);
registerDeploymentTarget('gcp-cloud-run', createGcpCloudRunTarget);

export type { DeploymentResult } from 'worker/services/sandbox/sandboxTypes';

// Backwards compatible adapter API (Cloudflare-only).
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
