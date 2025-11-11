/**
 * App Engine YAML Configuration Generator
 * 
 * Centralized utility for generating App Engine configuration files.
 * Used by both sandboxSdkClient and AppEngineDeployer to ensure consistency.
 */

export interface BackendConfig {
	entryPoint?: string; // e.g., "server.js", "index.js", "src/server.ts", "worker/index.js"
	// Note: port is not needed - App Engine Standard automatically sets PORT env variable
	envVariables?: Record<string, string>;
	// Hono-specific configuration
	clientDirectory?: string; // e.g., "dist/client", "client" (from assets.directory)
	apiRoutes?: string[]; // e.g., ["/api/*"] (from assets.run_worker_first)
	spaRouting?: boolean; // true if not_found_handling === "single-page-application"
	isHonoApp?: boolean; // true if detected from wrangler.jsonc
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
 * Note: Port is automatically handled by App Engine Standard via PORT environment variable
 * 
 * @param shortServiceName - Shortened service name (use generateShortServiceName to generate)
 * @param config - Backend configuration (entry point, env variables)
 * @returns YAML string for app.yaml configuration file
 */
export function generateBackendAppYaml(shortServiceName: string, config: BackendConfig = {}): string {
	const entryPoint = config.entryPoint || 'server.js';
	const envVars = config.envVariables || {};
	// Note: Port is automatically handled by App Engine Standard via PORT environment variable

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
	const envVars = backendConfig.envVariables || {};
	// Note: Port is automatically handled by App Engine Standard via PORT environment variable

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

/**
 * Generate minimal Node.js server entry point using @hono/node-server adapter
 * Always provides API support - tries to load backend, falls back to default handler if not found
 * 
 * @param projectName - Project name to try multiple potential backend paths
 * @param port - Port number (default 8080, App Engine uses PORT env var)
 * @returns TypeScript/JavaScript code for server.ts entry point
 */
export function generateHonoNodeServer(
	projectName: string,
	port: number = 8080
): string {
	// Normalize project name for path variations
	const normalizedProjectName = projectName.replace(/-/g, '_');
	const hyphenProjectName = projectName.replace(/_/g, '-');
	
	// Try multiple potential backend paths
	const possiblePaths = [
		`dist/${projectName}/index.js`,
		`dist/${normalizedProjectName}/index.js`,
		`dist/${hyphenProjectName}/index.js`,
		'dist/index.js'
	];
	
	return `import { serve } from '@hono/node-server';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Try to import Hono app from compiled backend
// Attempts multiple potential paths to handle naming variations
let app = null;
let backendLoaded = false;

const possiblePaths = ${JSON.stringify(possiblePaths)};

for (const relativePath of possiblePaths) {
	try {
		const resolvedPath = resolve(relativePath);
		const moduleUrl = pathToFileURL(resolvedPath).href;
		const honoModule = await import(moduleUrl);
		
		// Handle different export formats:
		// 1. export default { fetch: app.fetch } (Worker format)
		// 2. export default app (direct Hono app)
		// 3. export { app } (named export)
		if (honoModule.default) {
			if (typeof honoModule.default.fetch === 'function') {
				// Worker format: { fetch: app.fetch }
				app = { fetch: honoModule.default.fetch };
				backendLoaded = true;
				break;
			} else if (honoModule.default.fetch) {
				// Direct Hono app with fetch method
				app = honoModule.default;
				backendLoaded = true;
				break;
			} else if (typeof honoModule.default === 'object' && honoModule.default.fetch) {
				app = honoModule.default;
				backendLoaded = true;
				break;
			}
		}
		
		// Fallback to named exports
		if (!app && honoModule.app) {
			if (typeof honoModule.app.fetch === 'function') {
				app = honoModule.app;
				backendLoaded = true;
				break;
			} else if (honoModule.app) {
				app = honoModule.app;
				backendLoaded = true;
				break;
			}
		}
		
		if (app && typeof app.fetch === 'function') {
			backendLoaded = true;
			console.log('Hono app loaded successfully from', resolvedPath);
			break;
		}
	} catch (error) {
		// Continue to next path
		continue;
	}
}

// Fallback handler if no backend found
if (!app || !backendLoaded) {
	console.log('No backend code found, using fallback API handler');
	app = {
		fetch: async (request: Request) => {
			const url = new URL(request.url);
			
			// Handle API routes
			if (url.pathname.startsWith('/api/')) {
				return new Response(
					JSON.stringify({ 
						error: 'API endpoint not implemented',
						message: 'Backend code not found. Add backend routes to enable API functionality.',
						path: url.pathname
					}),
					{ 
						status: 404,
						headers: { 
							'Content-Type': 'application/json',
							'Access-Control-Allow-Origin': '*',
							'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
							'Access-Control-Allow-Headers': 'Content-Type'
						}
					}
				);
			}
			
			// For non-API routes, return 404 (should be handled by static files)
			return new Response('Not Found', { status: 404 });
		}
	};
}

// Start server using @hono/node-server
const port = Number(process.env.PORT ?? ${port});
serve({ fetch: app.fetch, port }, (info) => {
	console.log(\`Server running on port \${info.port}\`);
	console.log(\`Backend status: \${backendLoaded ? 'Loaded' : 'Fallback mode (no backend found)'}\`);
});
`;
}

/**
 * Generate app.yaml with default API support
 * Always includes API routes pointing to Node.js server, works for both frontend-only and full-stack apps
 * 
 * @param shortServiceName - Shortened service name
 * @param backendConfig - Backend configuration (optional, for logging purposes)
 * @returns YAML string for app.yaml configuration file
 */
export function generateDefaultAppYaml(shortServiceName: string, backendConfig: BackendConfig = {}): string {
	const clientDirectory = backendConfig.clientDirectory || 'dist/client';
	const apiRoutes = backendConfig.apiRoutes || ['/api/*'];
	const envVars = backendConfig.envVariables || {};

	// Build environment variables section
	const envVarsSection = Object.keys(envVars).length > 0
		? Object.entries(envVars)
			.map(([key, value]) => `  ${key}: "${String(value).replace(/"/g, '\\"')}"`)
			.join('\n')
		: '  NODE_ENV: production';

	// Build API route patterns (e.g., ["/api/*"] -> "/api/.*")
	const apiRouteHandlers = apiRoutes.map(route => {
		const normalizedRoute = route.startsWith('/') ? route.slice(1) : route;
		const pattern = normalizedRoute.replace(/\*/g, '.*');
		return `  - url: /${pattern}
    script: auto`;
	}).join('\n');

	return `runtime: nodejs20
service: ${shortServiceName}
instance_class: F1
automatic_scaling:
  min_instances: 0
  max_instances: 2
entrypoint: node dist/server.js
env_variables:
${envVarsSection}
handlers:
  # 1) API routes first → Node.js server (dist/server.js)
  # Always provides API support - server handles backend if available, or returns helpful errors
${apiRouteHandlers}
  
  # 2) Static assets (JS, CSS, images, fonts, etc.) with cache headers
  - url: /(.*\\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json|webp|map))$
    static_files: ${clientDirectory}/\\1
    upload: ${clientDirectory}/.*\\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json|webp|map)$
    expiration: 365d
    http_headers:
      Cache-Control: "public, max-age=31536000, immutable"
  
  # 3) SPA fallback - serve index.html for all other routes
  - url: /.*
    static_files: ${clientDirectory}/index.html
    upload: ${clientDirectory}/index.html
    expiration: 0s
    http_headers:
      Cache-Control: "no-cache, no-store, must-revalidate"
`;
}

/**
 * Generate app.yaml for Hono-based full-stack deployment using @hono/node-server
 * Handler order is critical: API routes first, then static assets, then SPA fallback
 * 
 * @deprecated Use generateDefaultAppYaml instead - it always provides API support
 * @param shortServiceName - Shortened service name
 * @param backendConfig - Backend configuration with Hono-specific fields
 * @returns YAML string for app.yaml configuration file
 */
export function generateHonoAppYaml(shortServiceName: string, backendConfig: BackendConfig = {}): string {
	// Entry point is dist/server.js (compiled from server.ts)
	const entryPoint = 'dist/server.js';
	const apiRoutes = backendConfig.apiRoutes || ['/api/*'];
	const clientDirectory = backendConfig.clientDirectory || 'dist/client';
	const envVars = backendConfig.envVariables || {};

	// Build environment variables section
	const envVarsSection = Object.keys(envVars).length > 0
		? Object.entries(envVars)
			.map(([key, value]) => `  ${key}: "${String(value).replace(/"/g, '\\"')}"`)
			.join('\n')
		: '  NODE_ENV: production';

	// Build API route patterns (e.g., ["/api/*"] -> "/api/.*")
	// For App Engine, we need separate handlers for each API route pattern
	const apiRouteHandlers = apiRoutes.map(route => {
		// Convert "/api/*" to "/api/.*" for regex (remove leading slash if present, then add it back)
		const normalizedRoute = route.startsWith('/') ? route.slice(1) : route;
		const pattern = normalizedRoute.replace(/\*/g, '.*');
		return `  - url: /${pattern}
    script: auto`;
	}).join('\n');

	return `runtime: nodejs20
service: ${shortServiceName}
instance_class: F1
automatic_scaling:
  min_instances: 0
  max_instances: 2
entrypoint: node ${entryPoint}
env_variables:
${envVarsSection}
handlers:
  # 1) API routes first → Node.js server (dist/server.js)
  # Order is critical: API routes must come before static files
${apiRouteHandlers}
  
  # 2) Static assets (JS, CSS, images, fonts, etc.) with cache headers
  - url: /(.*\\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json|webp|map))$
    static_files: ${clientDirectory}/\\1
    upload: ${clientDirectory}/.*\\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json|webp|map)$
    expiration: 365d
    http_headers:
      Cache-Control: "public, max-age=31536000, immutable"
  
  # 3) SPA fallback - serve index.html for all other routes
  - url: /.*
    static_files: ${clientDirectory}/index.html
    upload: ${clientDirectory}/index.html
    expiration: 0s
    http_headers:
      Cache-Control: "no-cache, no-store, must-revalidate"
`;
}

/**
 * Generate .gcloudignore for full-stack deployment (frontend + backend)
 * Includes both dist/client (frontend) and dist/server.js (backend)
 * 
 * @returns .gcloudignore file content
 */
export function generateFullStackGcloudignore(): string {
	return `# Exclude everything
*

# Include dist directory (frontend + backend)
!/dist/
!/dist/client/
!/dist/client/**
!/dist/server.js
!/dist/**/*.js  # Include all compiled backend files

# Include server.ts source (for debugging, optional)
!/server.ts

# Include app.yaml
!/app.yaml

# Include package.json for Node.js runtime
!/package.json

# Exclude sensitive files
.gcloud-key.json
.env
.env.local
node_modules/
src/
.git/
*.ts
*.tsx
*.jsx
tsconfig.json
`;
}
