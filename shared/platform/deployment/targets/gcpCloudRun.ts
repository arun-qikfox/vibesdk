import type { DeploymentInput, DeploymentStatus, DeploymentTarget } from '../index';
import { spawn } from 'node:child_process';
import { createLogger } from '../../../worker/logger';
import { DeploymentService } from '../../../worker/database/services/DeploymentService';
import { AppService } from '../../../worker/database/services/AppService';
import type { DatabaseRuntimeEnv } from 'worker/database/runtime/types';

type EnvLike = Record<string, unknown> | undefined | null;

const logger = createLogger('GcpCloudRunTarget');

export function createGcpCloudRunTarget(env: EnvLike): DeploymentTarget {
	return {
		id: 'gcp-cloud-run',
		async deploy(input: DeploymentInput) {
			try {
				logger.info('Starting GCP Cloud Run deployment', {
					instanceId: input.instanceId,
					projectName: input.projectName
				});

				// 1. Create Cloud Run context using the script
				const contextPath = await createCloudRunContext(input.instanceId, input.projectName);

				// 2. Upload context to GCS
				const gcsPath = await uploadToGCS(contextPath, input.instanceId);

				// 3. Trigger Cloud Build
				const buildId = await triggerCloudBuild(input.instanceId, gcsPath);

				// 4. Wait for completion and get service URL
				const serviceUrl = await waitForCloudBuildCompletion(buildId, input.instanceId);

				// 5. Record deployment metadata
				await recordDeploymentMetadata(input, serviceUrl);

				const deployedUrl = `https://${input.instanceId}-service-url`; // This will be replaced with actual URL logic

				logger.info('GCP Cloud Run deployment completed', {
					instanceId: input.instanceId,
					deployedUrl,
					serviceUrl
				});

				return {
					success: true,
					deploymentId: input.instanceId,
					deployedUrl,
					message: `Successfully deployed ${input.projectName} to Google Cloud Run`
				};
			} catch (error) {
				logger.error('GCP Cloud Run deployment failed', error, {
					instanceId: input.instanceId,
					projectName: input.projectName
				});

				// Record failed deployment
				try {
					await recordDeploymentMetadata(input, undefined, 'failed', error instanceof Error ? error.message : 'Unknown error');
				} catch (recordError) {
					logger.error('Failed to record deployment failure', recordError);
				}

				return {
					success: false,
					message: `Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
					error: error instanceof Error ? error.message : 'Unknown error'
				};
			}
		},

		async remove(appId: string, context?: DeploymentInput): Promise<void> {
			try {
				logger.info('Starting GCP Cloud Run removal', { appId });

				// Get the latest deployment for this app
				const dbEnv = context?.env as unknown as DatabaseRuntimeEnv;
				if (!dbEnv?.DB) {
					throw new Error('Database connection not available');
				}

				const deploymentService = new DeploymentService(dbEnv);
				const deployment = await deploymentService.getLatestDeployment(appId, 'gcp-cloud-run');

				if (!deployment || !deployment.serviceUrl) {
					logger.warn('No active Cloud Run deployment found for removal', { appId });
					return;
				}

				// Extract service name from URL (format: https://service-name-hash-uc.a.run.app)
				const serviceName = extractServiceNameFromUrl(deployment.serviceUrl);

				// Delete Cloud Run service
				await runGcloudCommand([
					'run', 'services', 'delete', serviceName,
					'--region=us-central1',
					'--quiet'
				]);

				// Mark deployment as removed in database
				if (context) {
					await recordDeploymentMetadata(context, deployment.serviceUrl, 'removed');
				}

				logger.info('GCP Cloud Run removal completed', { appId, serviceName });
			} catch (error) {
				logger.error('GCP Cloud Run removal failed', error, { appId });
				throw error;
			}
		},

		async status(appId: string, context?: DeploymentInput): Promise<DeploymentStatus> {
			try {
				// Query deployment metadata from database
				const dbEnv = context?.env as unknown as DatabaseRuntimeEnv;
				if (!dbEnv?.DB) {
					return {
						state: 'unknown',
						message: 'Database connection not available for status check'
					};
				}

				const deploymentService = new DeploymentService(dbEnv);
				const deployment = await deploymentService.getLatestDeployment(appId, 'gcp-cloud-run');

				if (!deployment) {
					return {
						state: 'unknown',
						message: 'No Cloud Run deployment found for this app'
					};
				}

				// Map database status to deployment status
				let state: DeploymentStatus['state'];
				switch (deployment.status) {
					case 'active':
						state = 'active';
						break;
					case 'deploying':
					case 'pending':
						state = 'deploying';
						break;
					case 'failed':
						state = 'error';
						break;
					case 'removed':
					default:
						state = 'unknown';
						break;
				}

				return {
					state,
					message: deployment.status === 'active' ? 'Service is running' : `Status: ${deployment.status}`,
					url: deployment.serviceUrl || undefined,
					updatedAt: deployment.updatedAt?.toISOString()
				};
			} catch (error) {
				logger.error('Status check failed', error, { appId });
				return {
					state: 'error',
					message: `Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
				};
			}
		},
	};
}

// Helper functions for Cloud Run deployment flow

async function createCloudRunContext(instanceId: string, projectName: string): Promise<string> {
	const outputPath = `/tmp/cloudrun-context-${instanceId}.tar.gz`;

	// Use the existing npm script to create context
	await runCommand('npm', [
		'run', 'cloudrun:context',
		'--', '--src', `./${instanceId}`, '--out', outputPath
	]);

	logger.info('Cloud Run context created', { instanceId, outputPath });
	return outputPath;
}

async function uploadToGCS(contextPath: string, instanceId: string): Promise<string> {
	const bucketName = process.env.GCS_DEPLOYMENT_BUCKET || 'vibesdk-deployment-contexts';
	const gcsPath = `gs://${bucketName}/${instanceId}-context.tar.gz`;

	await runCommand('gsutil', ['cp', contextPath, gcsPath]);

	logger.info('Context uploaded to GCS', { instanceId, gcsPath });
	return gcsPath;
}

async function triggerCloudBuild(instanceId: string, gcsPath: string): Promise<string> {
	// Use gcloud builds submit with the cloudbuild yaml config with proper substitutions
	const result = await runGcloudCommand([
		'builds', 'submit',
		'--config', 'cloudbuild/app-deploy.yaml',
		'--substitutions', `_SERVICE_NAME=${instanceId},_CONTEXT_TAR=${gcsPath},_REGION=us-central1,_LOCATION=us-central1,_REPOSITORY=vibesdk-apps`
	]);

	// Extract build ID from output (format: "Created build [build-id]")
	const buildIdMatch = result.match(/Created build \[([^\]]+)\]/);
	if (!buildIdMatch) {
		throw new Error(`Failed to extract build ID from Cloud Build submission. Output: ${result}`);
	}

	const buildId = buildIdMatch[1];
	logger.info('Cloud Build triggered', { instanceId, buildId });
	return buildId;
}

async function waitForCloudBuildCompletion(buildId: string, instanceId: string): Promise<string> {
	const maxWaitTime = 15 * 60 * 1000; // 15 minutes
	const pollInterval = 10000; // 10 seconds
	const startTime = Date.now();

	logger.info('Waiting for Cloud Build completion', { buildId, instanceId });

	while (Date.now() - startTime < maxWaitTime) {
		const result = await runGcloudCommand([
			'builds', 'describe', buildId,
			'--format', 'value(status)'
		]);

		const status = result.trim().toUpperCase();

		if (status === 'SUCCESS') {
			logger.info('Cloud Build completed successfully', { buildId, instanceId });
			return await getCloudRunServiceUrl(instanceId);
		} else if (status === 'FAILURE' || status === 'CANCELLED' || status === 'TIMEOUT') {
			throw new Error(`Cloud Build failed with status: ${status}`);
		}

		// Still running, wait and retry
		await new Promise(resolve => setTimeout(resolve, pollInterval));
	}

	throw new Error('Cloud Build timed out');
}

async function getCloudRunServiceUrl(serviceName: string): Promise<string> {
	const result = await runGcloudCommand([
		'run', 'services', 'describe', serviceName,
		'--region=us-central1',
		'--format', 'value(status.url)'
	]);

	const url = result.trim();
	if (!url) {
		throw new Error('Failed to retrieve Cloud Run service URL');
	}

	logger.info('Retrieved Cloud Run service URL', { serviceName, url });
	return url;
}

async function recordDeploymentMetadata(
	input: DeploymentInput,
	serviceUrl?: string,
	status: 'pending' | 'deploying' | 'active' | 'failed' | 'removed' = 'active',
	errorMessage?: string
): Promise<void> {
	const dbEnv = input.env as unknown as DatabaseRuntimeEnv;
	if (!dbEnv?.DB) {
		logger.warn('Database connection not available for recording deployment metadata');
		return;
	}

	// Get app ID from instance ID (assuming instanceId maps to app ID or we need to look it up)
	const appService = new AppService(dbEnv);
	const app = await appService.getAppByDeploymentId(input.instanceId);

	if (!app) {
		throw new Error(`App not found for deployment ID: ${input.instanceId}`);
	}

	const deploymentService = new DeploymentService(dbEnv);
	await deploymentService.recordDeployment({
		appId: app.id,
		target: 'gcp-cloud-run',
		version: 1, // Will be updated to handle versioning properly
		serviceUrl: serviceUrl,
		status: status,
		metadata: errorMessage ? { error: errorMessage } : {}
	});

	logger.info('Deployment metadata recorded', {
		appId: app.id,
		status,
		serviceUrl: serviceUrl || 'N/A'
	});
}

// Utility functions

async function runCommand(command: string, args: string[] = [], input?: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const proc = spawn(command, args, { stdio: input ? 'pipe' : 'inherit' });

		let stdout = '';
		let stderr = '';

		if (proc.stdout) {
			proc.stdout.on('data', (data) => {
				stdout += data.toString();
			});
		}

		if (proc.stderr) {
			proc.stderr.on('data', (data) => {
				stderr += data.toString();
			});
		}

		if (input && proc.stdin) {
			proc.stdin.write(input);
			proc.stdin.end();
		}

		proc.on('close', (code) => {
			if (code === 0) {
				resolve(stdout);
			} else {
				reject(new Error(`Command failed: ${command} ${args.join(' ')}\nSTDOUT: ${stdout}\nSTDERR: ${stderr}`));
			}
		});

		proc.on('error', (error) => {
			reject(error);
		});
	});
}

async function runGcloudCommand(args: string[], input?: string): Promise<string> {
	const gcloudArgs = [...args];

	// Add project if specified
	if (process.env.GCP_PROJECT_ID) {
		gcloudArgs.unshift('--project', process.env.GCP_PROJECT_ID);
	}

	return runCommand('gcloud', gcloudArgs, input);
}

function extractServiceNameFromUrl(serviceUrl: string): string {
	// Example: https://my-service-abc123-uc.a.run.app -> my-service-abc123
	try {
		const url = new URL(serviceUrl);
		const hostname = url.hostname;
		// Remove region prefix (e.g., -uc.a.run.app -> a.run.app)
		const servicePart = hostname.replace(/^(.+?-\w+)\.a\.run\.app$/, '$1');
		return servicePart;
	} catch {
		throw new Error(`Invalid Cloud Run service URL: ${serviceUrl}`);
	}
}
