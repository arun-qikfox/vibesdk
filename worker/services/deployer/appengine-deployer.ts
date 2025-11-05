import { createLogger } from '../../logger';

const logger = createLogger('AppEngineDeployer');

export interface AppEngineDeployConfig {
	projectId: string;
	serviceAccountKey: string; // JSON key file content (base64 encoded)
	appName: string;
	staticFiles: Map<string, Buffer>; // path -> content
	appYaml: string;
}

export interface AppEngineDeployResult {
	success: boolean;
	url?: string;
	versionId?: string;
	error?: string;
}

export class AppEngineDeployer {
	private readonly projectId: string;
	// Store serviceAccountKey for potential future use (e.g., API calls)
	// @ts-expect-error - Stored for future implementation, intentionally unused for now
	private readonly serviceAccountKey: string;

	constructor(projectId: string, serviceAccountKey: string) {
		this.projectId = projectId;
		this.serviceAccountKey = serviceAccountKey; // Store for potential future use
	}

	/**
	 * Deploy static frontend to App Engine
	 * Only handles static files - no backend code
	 * 
	 * Note: This is a simplified implementation for Phase 1.
	 * In production, implement proper file upload via App Engine Admin API.
	 */
	async deployStaticFrontend(config: AppEngineDeployConfig): Promise<AppEngineDeployResult> {
		try {
			logger.info('Deploying static frontend to App Engine', { appName: config.appName });

			// For Phase 1, we'll return a placeholder implementation
			// The actual deployment will be handled by executing gcloud commands in the sandbox
			// This method is called but the real work happens in sandboxSdkClient.ts
			
			// Generate short service name for URL (to avoid domain size limitations)
			const shortServiceName = await this.generateShortServiceName(config.appName);
			
			// Generate deployment URL using short service name
			const url = `https://${shortServiceName}.${this.projectId}.appspot.com`;
			const versionId = `v${Date.now()}`;

			logger.info('App Engine deployment placeholder', {
				appName: config.appName,
				shortServiceName,
				url,
				versionId,
			});

			return {
				success: true,
				url,
				versionId,
			};
		} catch (error) {
			logger.error('App Engine deployment failed', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	/**
	 * Generate a short, unique App Engine service name from a project name
	 * Ensures the name is within App Engine's 63-character limit and maintains uniqueness
	 * 
	 * @param appName - Original project/app name
	 * @returns Shortened service name suitable for App Engine (e.g., "app-a1b2c3d4")
	 */
	async generateShortServiceName(appName: string): Promise<string> {
		// Normalize the name: lowercase, replace invalid chars with hyphens
		const normalized = appName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
		
		// Extract prefix (first part before hyphen, or first 10 chars if no hyphen)
		// Ensure we have at least 3 chars for readability
		let prefix = normalized.includes('-') 
			? normalized.split('-')[0].slice(0, 10)
			: normalized.slice(0, 10);
		
		// If prefix is empty or too short, use a default
		if (!prefix || prefix.length < 3) {
			prefix = 'app'; // Default prefix
		}
		
		// Generate SHA-256 hash and take first 8 hex characters for uniqueness
		const encoder = new TextEncoder();
		const data = encoder.encode(appName);
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
		
		// Combine prefix and hash: "prefix-hash" (max ~18 chars, well under 63 limit)
		const shortName = `${prefix}-${hashHex}`;
		
		// Ensure it doesn't exceed App Engine's limit (63 chars) and is valid
		return shortName.slice(0, 63).replace(/^[-]+|[-]+$/g, ''); // Remove leading/trailing hyphens
	}

	/**
	 * Generate app.yaml for static frontend deployment
	 * Configured to serve React SPA correctly with client-side routing support
	 * @param shortServiceName - Shortened service name (use generateShortServiceName to generate)
	 */
	generateStaticAppYaml(shortServiceName: string): string {
		return `runtime: nodejs20
service: ${shortServiceName}
instance_class: F1
automatic_scaling:
  min_instances: 0
  max_instances: 2
handlers:
  # Serve static assets (JS, CSS, images, etc.) with proper cache headers
  - url: /(.*\\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json|webp|map))$
    static_files: dist/\\1
    upload: dist/.*\\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json|webp|map)$
    expiration: 1y
    http_headers:
      Cache-Control: "public, max-age=31536000, immutable"
  # Serve all other routes with index.html for React Router/client-side routing
  - url: /.*
    static_files: dist/index.html
    upload: dist/index.html
    expiration: 0s
    http_headers:
      Cache-Control: "no-cache, no-store, must-revalidate"
env_variables:
  NODE_ENV: production
`;
	}
}

