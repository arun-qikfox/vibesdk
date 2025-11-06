/**
 * App Engine YAML Configuration Generator
 * 
 * Centralized utility for generating App Engine configuration files.
 * Used by both sandboxSdkClient and AppEngineDeployer to ensure consistency.
 */

export interface BackendConfig {
	entryPoint?: string; // e.g., "server.js", "index.js", "src/server.ts"
	port?: number; // Default: 8080 (App Engine standard)
	envVariables?: Record<string, string>;
}

/**
 * Generate app.yaml for static frontend deployment to Google App Engine
 * Configured to serve React SPA correctly with client-side routing support
 * 
 * @param shortServiceName - Shortened service name (use generateShortServiceName to generate)
 * @returns YAML string for app.yaml configuration file
 */
export function generateStaticAppYaml(shortServiceName: string): string {
	return `runtime: nodejs20
service: ${shortServiceName}
instance_class: F1
automatic_scaling:
  min_instances: 0
  max_instances: 2
handlers:
  # Serve static assets (JS, CSS, images, fonts, etc.) with cache headers
  - url: /(.*\\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json|webp|map))$
    static_files: dist/client/\\1
    upload: dist/client/.*\\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json|webp|map)$
    expiration: 365d
    http_headers:
      Cache-Control: "public, max-age=31536000, immutable"
  # Serve index.html for all other routes (React / SPA)
  - url: /.*
    static_files: dist/client/index.html
    upload: dist/client/index.html
    expiration: 0s
    http_headers:
      Cache-Control: "no-cache, no-store, must-revalidate"
env_variables:
  NODE_ENV: production
`;
}

/**
 * Generate a short, unique App Engine service name from a project name
 * Ensures the name is within App Engine's 63-character limit and maintains uniqueness
 * 
 * @param appName - Original project/app name
 * @returns Shortened service name suitable for App Engine (e.g., "app-a1b2c3d4")
 */
export async function generateShortServiceName(appName: string): Promise<string> {
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
 * Generate app.yaml for backend API deployment to Google App Engine
 * Configured for Node.js runtime with API endpoints
 * 
 * @param shortServiceName - Shortened service name (use generateShortServiceName to generate)
 * @param config - Backend configuration (entry point, port, env variables)
 * @returns YAML string for app.yaml configuration file
 */
export function generateBackendAppYaml(shortServiceName: string, config: BackendConfig = {}): string {
	const entryPoint = config.entryPoint || 'server.js';
	const port = config.port || 8080;
	const envVars = config.envVariables || {};

	// Build environment variables section
	const envVarsSection = Object.keys(envVars).length > 0
		? Object.entries(envVars)
			.map(([key, value]) => `  ${key}: "${String(value).replace(/"/g, '\\"')}"`)
			.join('\n')
		: '  NODE_ENV: production';

	return `runtime: nodejs20
service: ${shortServiceName}
instance_class: F1
automatic_scaling:
  min_instances: 0
  max_instances: 10
  target_cpu_utilization: 0.6
  target_throughput_utilization: 0.6
entrypoint: node ${entryPoint}
env_variables:
${envVarsSection}
handlers:
  # Serve all requests to the Node.js application
  - url: /.*
    script: auto
`;
}

/**
 * Generate app.yaml for full-stack deployment (frontend + backend)
 * Creates a single service that serves both frontend and backend
 * 
 * @param shortServiceName - Shortened service name
 * @param backendConfig - Backend configuration
 * @returns YAML string for app.yaml configuration file
 */
export function generateFullStackAppYaml(shortServiceName: string, backendConfig: BackendConfig = {}): string {
	const entryPoint = backendConfig.entryPoint || 'server.js';
	const port = backendConfig.port || 8080;
	const envVars = backendConfig.envVariables || {};

	// Build environment variables section
	const envVarsSection = Object.keys(envVars).length > 0
		? Object.entries(envVars)
			.map(([key, value]) => `  ${key}: "${String(value).replace(/"/g, '\\"')}"`)
			.join('\n')
		: '  NODE_ENV: production';

	return `runtime: nodejs20
service: ${shortServiceName}
instance_class: F1
automatic_scaling:
  min_instances: 0
  max_instances: 10
  target_cpu_utilization: 0.6
  target_throughput_utilization: 0.6
entrypoint: node ${entryPoint}
env_variables:
${envVarsSection}
handlers:
  # Serve static assets (JS, CSS, images, fonts, etc.) with cache headers
  - url: /(.*\\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json|webp|map))$
    static_files: dist/client/\\1
    upload: dist/client/.*\\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json|webp|map)$
    expiration: 365d
    http_headers:
      Cache-Control: "public, max-age=31536000, immutable"
  # API routes - serve to backend
  - url: /api/.*
    script: auto
  # All other routes - serve to backend (which will handle SPA routing)
  - url: /.*
    script: auto
`;
}
