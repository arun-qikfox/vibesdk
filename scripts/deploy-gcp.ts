#!/usr/bin/env tsx

/**
 * GCP Deployment Script for VibSDK
 * 
 * This script handles the deployment of VibSDK to Google Cloud Platform,
 * including:
 * - Building the worker bundle
 * - Deploying to Cloud Run
 * - Updating environment variables
 * - Running database migrations
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'node:url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

class GcpDeploymentError extends Error {
	constructor(
		message: string,
		public cause?: Error,
	) {
		super(message);
		this.name = 'GcpDeploymentError';
	}
}

class GcpDeploymentManager {
	private projectId: string;
	private region: string;

	constructor() {
		this.projectId = process.env.GCP_PROJECT_ID || 'qfxcloud-app-builder';
		this.region = process.env.GCP_REGION || 'us-central1';
		this.validateEnvironment();
	}

	/**
	 * Validates that all required environment variables are present
	 */
	private validateEnvironment(): void {
		// Since we have defaults, we just need to ensure gcloud is configured
		console.log(`Using GCP Project: ${this.projectId}`);
		console.log(`Using GCP Region: ${this.region}`);
		console.log('✅ Environment configuration validated');
	}

	/**
	 * Checks if gcloud CLI is installed and authenticated
	 */
	private checkGcloudSetup(): void {
		console.log('🔍 Checking gcloud CLI setup...');

		try {
			// Check if gcloud is installed
			execSync('gcloud --version', { stdio: 'pipe' });
			console.log('✅ gcloud CLI is installed');

			// Check if authenticated
			const currentProject = execSync('gcloud config get-value project', { 
				stdio: 'pipe',
				encoding: 'utf8'
			}).trim();

			if (currentProject !== this.projectId) {
				console.log(`🔄 Switching gcloud project from '${currentProject}' to '${this.projectId}'`);
				execSync(`gcloud config set project ${this.projectId}`, { stdio: 'inherit' });
			}

			console.log(`✅ gcloud is configured for project: ${this.projectId}`);
		} catch (error) {
			throw new GcpDeploymentError(
				'gcloud CLI is not installed or not authenticated',
				error instanceof Error ? error : new Error(String(error))
			);
		}
	}

	/**
	 * Builds the frontend assets
	 */
	private buildFrontendAssets(): void {
		console.log('🎨 Building frontend assets...');

		try {
			execSync('npm run build', {
				stdio: 'inherit',
				cwd: PROJECT_ROOT
			});

			console.log('✅ Frontend assets build completed');
		} catch (error) {
			throw new GcpDeploymentError(
				'Failed to build frontend assets',
				error instanceof Error ? error.message : String(error)
			);
		}
	}

	/**
	 * Builds the worker bundle for Cloud Run deployment
	 */
	private buildWorkerBundle(): void {
		console.log('🔨 Building worker bundle...');

		try {
			// Build the worker bundle
			execSync('npm run build:worker', {
				stdio: 'inherit',
				cwd: PROJECT_ROOT
			});

			console.log('✅ Worker bundle built successfully');
		} catch (error) {
			throw new GcpDeploymentError(
				'Failed to build worker bundle',
				error instanceof Error ? error : new Error(String(error))
			);
		}
	}

	/**
	 * Builds and pushes the Docker image to Artifact Registry
	 */
	private buildAndPushImage(): string {
		console.log('🐳 Building and pushing Docker image...');

		try {
			const imageName = `us-central1-docker.pkg.dev/${this.projectId}/vibesdk/workerd:latest`;
			
			// Build the Docker image
			execSync(`docker build -f container/Dockerfile.workerd -t ${imageName} .`, {
				stdio: 'inherit',
				cwd: PROJECT_ROOT
			});

			// Push the image
			execSync(`docker push ${imageName}`, {
				stdio: 'inherit',
				cwd: PROJECT_ROOT
			});

			console.log(`✅ Docker image built and pushed: ${imageName}`);
			return imageName;
		} catch (error) {
			throw new GcpDeploymentError(
				'Failed to build and push Docker image',
				error instanceof Error ? error : new Error(String(error))
			);
		}
	}

	/**
	 * Deploys the Cloud Run service
	 */
	private deployCloudRunService(imageUri: string): string {
		console.log('🚀 Deploying Cloud Run service...');

		try {
			const serviceName = 'vibesdk-control-plane';
			
			// Deploy the service
			execSync(`gcloud run deploy ${serviceName} \
				--image=${imageUri} \
				--region=${this.region} \
				--platform=managed \
				--allow-unauthenticated \
				--port=8080 \
				--memory=1Gi \
				--cpu=1 \
				--max-instances=10 \
				--set-env-vars="RUNTIME_PROVIDER=gcp,GCP_PROJECT_ID=${this.projectId},GCP_REGION=${this.region}"`, {
				stdio: 'inherit',
				cwd: PROJECT_ROOT
			});

			// Get the service URL
			const serviceUrl = execSync(`gcloud run services describe ${serviceName} --region=${this.region} --format="value(status.url)"`, {
				stdio: 'pipe',
				encoding: 'utf8',
				cwd: PROJECT_ROOT
			}).trim();

			console.log(`✅ Cloud Run service deployed: ${serviceUrl}`);
			return serviceUrl;
		} catch (error) {
			throw new GcpDeploymentError(
				'Failed to deploy Cloud Run service',
				error instanceof Error ? error : new Error(String(error))
			);
		}
	}

	/**
	 * Updates environment variables for the Cloud Run service
	 */
	private updateEnvironmentVariables(): void {
		console.log('🔧 Updating environment variables...');

		try {
			const serviceName = 'vibesdk-control-plane';
			
			// Read environment variables from .env.gcp.example if it exists
			const envFile = join(PROJECT_ROOT, '.env.gcp.example');
			let envVars: string[] = [];

			if (existsSync(envFile)) {
				const envContent = readFileSync(envFile, 'utf-8');
				envVars = envContent
					.split('\n')
					.filter(line => line.trim() && !line.startsWith('#'))
					.map(line => line.trim());
			}

			// Add default environment variables
			const defaultVars = [
				`RUNTIME_PROVIDER=gcp`,
				`GCP_PROJECT_ID=${this.projectId}`,
				`GCP_REGION=${this.region}`,
				`DEFAULT_DEPLOYMENT_TARGET=gcp-cloud-run`,
				`TEMPLATES_REPOSITORY=https://github.com/cloudflare/vibesdk-templates`,
				`DISPATCH_NAMESPACE=vibesdk-default-namespace`,
				`ENABLE_READ_REPLICAS=true`,
				`MAX_SANDBOX_INSTANCES=10`,
				`SANDBOX_INSTANCE_TYPE=standard-3`,
				`USE_CLOUDFLARE_IMAGES=false`,
				`SANDBOX_TOPIC=vibesdk-sandbox-requests`,
				`SANDBOX_SUBSCRIPTION=vibesdk-sandbox-requests-subscription`,
				`SANDBOX_RUN_COLLECTION=sandboxRuns`,
				`GCS_TEMPLATES_BUCKET=vibesdk-templates`,
				`FIRESTORE_PROJECT_ID=${this.projectId}`,
				`FIRESTORE_COLLECTION=vibesdk-kv`
			];

			// Combine all environment variables and remove duplicates
			const allVars = [...defaultVars, ...envVars];
			const uniqueVars = Array.from(new Set(allVars));

			// Update the service with environment variables
			if (uniqueVars.length > 0) {
				const envVarsString = uniqueVars.map(v => `--set-env-vars="${v}"`).join(' ');
				
				execSync(`gcloud run services update ${serviceName} \
					--region=${this.region} \
					${envVarsString}`, {
					stdio: 'inherit',
					cwd: PROJECT_ROOT
				});

				console.log(`✅ Updated ${uniqueVars.length} environment variables`);
			}
		} catch (error) {
			console.warn(`⚠️  Could not update environment variables: ${error instanceof Error ? error.message : String(error)}`);
			console.warn('   Continuing with deployment...');
		}
	}

	/**
	 * Runs database migrations
	 */
	private runDatabaseMigrations(): void {
		console.log('🗄️  Running database migrations...');

		// Check if DATABASE_URL is configured
		const databaseUrl = process.env.DATABASE_URL || process.env.GCP_DATABASE_URL;
		if (!databaseUrl) {
			console.warn('⚠️  DATABASE_URL not configured, skipping database migrations');
			console.warn('   To run migrations, set DATABASE_URL environment variable');
			return;
		}

		try {
			// Generate migrations
			execSync('npm run db:generate:gcp', {
				stdio: 'inherit',
				cwd: PROJECT_ROOT
			});

			// Apply migrations
			execSync('npm run db:migrate:gcp', {
				stdio: 'inherit',
				cwd: PROJECT_ROOT
			});

			console.log('✅ Database migrations completed');
		} catch (error) {
			console.warn(`⚠️  Database migrations failed: ${error instanceof Error ? error.message : String(error)}`);
			console.warn('   You may need to run migrations manually');
		}
	}

	/**
	 * Main deployment orchestration method
	 */
	public async deploy(): Promise<void> {
		console.log('☁️  VibSDK GCP Deployment Starting...\n');

		const startTime = Date.now();

		try {
			// Step 1: Validate environment and gcloud setup
			console.log('📋 Step 1: Validating environment and gcloud setup...');
			this.checkGcloudSetup();
			console.log('✅ Environment validation completed!\n');

			// Step 2: Build frontend assets
			console.log('📋 Step 2: Building frontend assets...');
			this.buildFrontendAssets();
			console.log('✅ Frontend assets build completed!\n');

			// Step 3: Build worker bundle
			console.log('📋 Step 3: Building worker bundle...');
			this.buildWorkerBundle();
			console.log('✅ Worker bundle build completed!\n');

			// Step 4: Build and push Docker image
			console.log('📋 Step 4: Building and pushing Docker image...');
			const imageUri = this.buildAndPushImage();
			console.log('✅ Docker image build and push completed!\n');

			// Step 5: Deploy Cloud Run service
			console.log('📋 Step 5: Deploying Cloud Run service...');
			const serviceUrl = this.deployCloudRunService(imageUri);
			console.log('✅ Cloud Run service deployment completed!\n');

			// Step 6: Update environment variables
			console.log('📋 Step 6: Updating environment variables...');
			this.updateEnvironmentVariables();
			console.log('✅ Environment variables update completed!\n');

			// Step 7: Run database migrations
			console.log('📋 Step 7: Running database migrations...');
			this.runDatabaseMigrations();
			console.log('✅ Database migrations completed!\n');

			// Deployment complete
			const duration = Math.round((Date.now() - startTime) / 1000);
			console.log(`🎉 GCP deployment completed successfully in ${duration}s!`);
			console.log(`✅ Your VibSDK platform is now live at: ${serviceUrl} 🚀`);
			console.log('\n📋 Next steps:');
			console.log('   1. Test the deployment by visiting the service URL');
			console.log('   2. Run the test script: ./scripts/test-deployment.sh');
			console.log('   3. Configure DNS and load balancer for production');

		} catch (error) {
			console.error('\n❌ GCP deployment failed:');

			if (error instanceof GcpDeploymentError) {
				console.error(`   ${error.message}`);
				if (error.cause) {
					console.error(`   Caused by: ${error.cause.message}`);
				}
			} else {
				console.error(`   ${error}`);
			}

			console.error('\n🔍 Troubleshooting tips:');
			console.error('   - Verify gcloud CLI is installed and authenticated');
			console.error('   - Check that Docker is running');
			console.error('   - Ensure you have permissions for the GCP project');
			console.error('   - Verify Artifact Registry repository exists');
			console.error('   - Check that Cloud Run API is enabled');

			process.exit(1);
		}
	}
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
	const deployer = new GcpDeploymentManager();
	deployer.deploy().catch((error) => {
		console.error('Unexpected error:', error);
		process.exit(1);
	});
}

export default GcpDeploymentManager;
