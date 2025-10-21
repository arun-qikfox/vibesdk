import { createLogger } from './logger';
import { SmartCodeGeneratorAgent } from './agents/core/smartGeneratorAgent';
import { proxyToSandbox } from '@cloudflare/sandbox';
import { isDispatcherAvailable } from './utils/dispatcherUtils';
import { createApp } from './app';
// import * as Sentry from '@sentry/cloudflare';
// import { sentryOptions } from './observability/sentry';
import { DORateLimitStore as BaseDORateLimitStore } from './services/rate-limit/DORateLimitStore';
import { getPreviewDomain } from './utils/urls';
// import { proxyToAiGateway } from './services/aigateway-proxy/controller';
import { isOriginAllowed } from './config/security';
import { getRuntimeProvider, RuntimeProvider } from 'shared/platform/runtimeProvider';
import {
	createObjectStore,
	type ObjectStoreGetResult,
} from 'shared/platform/storage';
import { ensureSecrets } from './utils/secretLoader';
import { createAgentStore } from 'shared/platform/durableObjects';
import type { AppDeploymentStatus } from './database/schema';
import type { DatabaseRuntimeEnv } from './database/runtime/types';

// Durable Object and Service exports
export { UserAppSandboxService, DeployerService } from './services/sandbox/sandboxSdkClient';

// export const CodeGeneratorAgent = Sentry.instrumentDurableObjectWithSentry(sentryOptions, SmartCodeGeneratorAgent);
// export const DORateLimitStore = Sentry.instrumentDurableObjectWithSentry(sentryOptions, BaseDORateLimitStore);
export const CodeGeneratorAgent = SmartCodeGeneratorAgent;
export const DORateLimitStore = BaseDORateLimitStore;

// Logger for the main application and handlers
const logger = createLogger('App');

function setOriginControl(env: Env, request: Request, currentHeaders: Headers): Headers {
    const origin = request.headers.get('Origin');
    
    if (origin && isOriginAllowed(env, origin)) {
        currentHeaders.set('Access-Control-Allow-Origin', origin);
    }
    return currentHeaders;
}

function buildAssetKeyCandidates(pathname: string): string[] {
	const cleanPath = pathname.replace(/[#?].*$/, '');
	let key = cleanPath.replace(/^\/+/, '');
	if (key === '') {
		key = 'index.html';
	}
	if (key.endsWith('/')) {
		key = `${key}index.html`;
	}
	const candidates = [key];
	if (!key.endsWith('.html')) {
		candidates.push('index.html');
	}
	return [...new Set(candidates)];
}

async function responseFromStoreResult(
	result: ObjectStoreGetResult & { etag?: string },
	method: string,
): Promise<Response> {
	const headers = new Headers();
	const metadata = result.httpMetadata;
	if (metadata?.contentType) {
		headers.set('Content-Type', metadata.contentType);
	}
	if (metadata?.cacheControl) {
		headers.set('Cache-Control', metadata.cacheControl);
	}
	if (metadata?.contentLanguage) {
		headers.set('Content-Language', metadata.contentLanguage);
	}
	if (metadata?.contentDisposition) {
		headers.set('Content-Disposition', metadata.contentDisposition);
	}
	if (result.etag) {
		headers.set('ETag', result.etag);
	}
	if (method.toUpperCase() === 'HEAD') {
		return new Response(null, { status: 200, headers });
	}
	const buffer = await result.arrayBuffer();
	if (!headers.has('Content-Type')) {
		headers.set('Content-Type', 'application/octet-stream');
	}
	headers.set('Content-Length', buffer.byteLength.toString());
	return new Response(buffer, { status: 200, headers });
}

async function serveAssetFromObjectStore(request: Request, env: Env): Promise<Response | null> {
	const store = createObjectStore(env as unknown as Record<string, unknown>);
	const url = new URL(request.url);
	const candidates = buildAssetKeyCandidates(url.pathname);
	for (const key of candidates) {
		try {
			const asset = await store.get(key);
			if (!asset) {
				continue;
			}
			return await responseFromStoreResult(asset, request.method);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logger.error(`Failed to read asset from GCS (key=${key})`, { error: message });
			throw error;
		}
	}
	return null;
}

function mapDeploymentStatusToHttp(
	status: AppDeploymentStatus,
): { status: number; message: string } {
	switch (status) {
		case 'deploying':
		case 'pending':
			return { status: 202, message: 'Deployment is still in progress.' };
		case 'failed':
			return {
				status: 502,
				message: 'Latest deployment failed. Please redeploy the application.',
			};
		case 'removed':
			return {
				status: 404,
				message: 'This application preview is no longer available.',
			};
		default:
			return {
				status: 503,
				message: 'Deployment metadata is incomplete. Please redeploy the application.',
			};
	}
}

async function proxyCloudRunAppRequest(request: Request, env: Env): Promise<Response> {
	const previewDomain = getPreviewDomain(env);
	const url = new URL(request.url);
	const { hostname } = url;

	if (!previewDomain || !hostname.endsWith(`.${previewDomain}`)) {
		logger.warn('Attempted Cloud Run preview access with mismatched domain', {
			hostname,
			previewDomain,
		});
		return new Response('Preview environment not found.', { status: 404 });
	}

	const deploymentKey = hostname.slice(0, hostname.length - previewDomain.length - 1);
	if (!deploymentKey) {
		return new Response('Preview environment not found.', { status: 404 });
	}

	// Simplified for GCP deployment - return a basic response
	// In production, this would check PostgreSQL for app and deployment info
	return new Response('QFX Cloud App Preview - Feature coming soon', { 
		status: 200,
		headers: {
			'Content-Type': 'text/html',
			'X-Preview-Type': 'cloud-run'
		}
	});
}

/**
 * Handles requests for user-deployed applications on subdomains.
 * It first attempts to proxy to a live development sandbox. If that fails,
 * it checks for Cloud Run deployments first, then falls back to Cloudflare Workers dispatch.
 * This function will NOT fall back to the main worker.
 *
 * @param request The incoming Request object.
 * @param env The environment bindings.
 * @returns A Response object from the sandbox, Cloud Run, dispatched worker, or an error.
 */
async function handleUserAppRequest(request: Request, env: Env, _runtimeProvider: RuntimeProvider): Promise<Response> {
	const url = new URL(request.url);
	const { hostname } = url;
	logger.info(`Handling user app request for: ${hostname}`);

	// 1. Attempt to proxy to a live development sandbox.
	// proxyToSandbox doesn't consume the request body on a miss, so no clone is needed here.
	const sandboxResponse = await proxyToSandbox(request, env);
	if (sandboxResponse) {
		logger.info(`Serving response from sandbox for: ${hostname}`);

		// Add headers to identify this as a sandbox response
		let headers = new Headers(sandboxResponse.headers);

		if (sandboxResponse.status === 500) {
			headers.set('X-Preview-Type', 'sandbox-error');
		} else {
			headers.set('X-Preview-Type', 'sandbox');
		}
		headers = setOriginControl(env, request, headers);
		headers.append('Vary', 'Origin');
		headers.set('Access-Control-Expose-Headers', 'X-Preview-Type');

		return new Response(sandboxResponse.body, {
			status: sandboxResponse.status,
			statusText: sandboxResponse.statusText,
			headers,
		});
	}

	// 2. Check if this is a Cloud Run preview request (multi-cloud support)
	const previewDomain = getPreviewDomain(env);
	if (previewDomain && hostname.endsWith(`.${previewDomain}`)) {
		try {
			const cloudRunResponse = await proxyCloudRunAppRequest(request, env);
			logger.info(`Routing to Cloud Run deployment for: ${hostname}`);
			return cloudRunResponse;
		} catch (error) {
			logger.warn(`Cloud Run routing failed for ${hostname}, falling back to dispatcher`, error);
			// Continue to dispatcher fallback
		}
	}

	// 3. If sandbox misses and Cloud Run is not available/applicable, attempt to dispatch to a deployed worker.
	// This maintains backwards compatibility with existing Cloudflare deployments.
	logger.info(`Sandbox and Cloud Run miss for ${hostname}, attempting dispatch to permanent worker.`);
	if (!isDispatcherAvailable(env)) {
		logger.warn(`Dispatcher not available, cannot serve: ${hostname}`);
		return new Response('This application is not currently available.', { status: 404 });
	}

	// Extract the app name (e.g., "xyz" from "xyz.build.cloudflare.dev").
	const appName = hostname.split('.')[0];
	const dispatcher = env['DISPATCHER'];

	try {
		const worker = dispatcher.get(appName);
		const dispatcherResponse = await worker.fetch(request);

		// Add headers to identify this as a dispatcher response
		let headers = new Headers(dispatcherResponse.headers);

		headers.set('X-Preview-Type', 'dispatcher');
		headers = setOriginControl(env, request, headers);
		headers.append('Vary', 'Origin');
		headers.set('Access-Control-Expose-Headers', 'X-Preview-Type');

		return new Response(dispatcherResponse.body, {
			status: dispatcherResponse.status,
			statusText: dispatcherResponse.statusText,
			headers,
		});
	} catch (error: any) {
		// This block catches errors if the binding doesn't exist or if worker.fetch() fails.
		logger.warn(`Error dispatching to worker '${appName}': ${error.message}`);
		return new Response('An error occurred while loading this application.', { status: 500 });
	}
}

/**
 * Main Worker fetch handler with robust, secure routing.
 */
let secretsLoaded = false;

const worker = {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const runtimeProvider = getRuntimeProvider(env);
        logger.info(`Received request: ${request.method} ${request.url} (runtime: ${runtimeProvider})`);

		if (!secretsLoaded && runtimeProvider === 'gcp') {
			await ensureSecrets(env);
			secretsLoaded = true;
		}

		try {
			const agentStore = createAgentStore(runtimeProvider, env as unknown as Record<string, unknown>);
			(env as unknown as Record<string, unknown>).AgentStore = agentStore;
		} catch (error) {
			logger.warn('Agent store initialization failed', { error });
		}

		const envRecord = env as unknown as Record<string, unknown>;
		if (!('DB' in envRecord) && typeof envRecord.DATABASE_URL === 'string') {
			if (typeof process !== 'undefined' && process.env) {
				process.env.DATABASE_URL = envRecord.DATABASE_URL;
			}
		}

		// --- Pre-flight Checks ---

		// 1. Critical configuration check: Ensure custom domain is set.
        const previewDomain = getPreviewDomain(env);
		if (!previewDomain || previewDomain.trim() === '') {
			// For Cloud Run, use the hostname as the domain
			const url = new URL(request.url);
			const hostname = url.hostname;
			
			// If it's a Cloud Run URL, use it as the domain
			if (hostname.endsWith('.run.app')) {
				logger.info(`Using Cloud Run hostname as domain: ${hostname}`);
				// Set a mock preview domain for Cloud Run
				(env as any).CUSTOM_DOMAIN = hostname;
			} else {
				logger.error('FATAL: env.CUSTOM_DOMAIN is not configured and not a Cloud Run URL.');
				return new Response('Server configuration error: Application domain is not set.', { status: 500 });
			}
		}

		const url = new URL(request.url);
		const { hostname, pathname } = url;

		// 2. Security: Immediately reject any requests made via an IP address.
		const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
		if (ipRegex.test(hostname)) {
			return new Response('Access denied. Please use the assigned domain name.', { status: 403 });
		}

		// --- Domain-based Routing ---

		// Normalize hostnames for both local development (localhost) and production.
		// Handle Cloud Run URLs (e.g., *.run.app) as main domain requests
		const isCloudRunUrl = hostname.endsWith('.run.app');
		const isMainDomainRequest =
			hostname === env.CUSTOM_DOMAIN || 
			hostname === 'localhost' ||
			isCloudRunUrl;
		const isSubdomainRequest =
			hostname.endsWith(`.${previewDomain}`) ||
			(hostname.endsWith('.localhost') && hostname !== 'localhost');

		// Route 1: Main Platform Request (e.g., build.cloudflare.dev or localhost)
		if (isMainDomainRequest) {
			// Handle API requests and root/health endpoints
			if (pathname.startsWith('/api/') || pathname === '/' || pathname === '/health') {
				const app = createApp(env);
				return app.fetch(request, env, ctx);
			}
			
			// Serve static assets for all other routes from the object store in GCP,
			// falling back to the legacy ASSETS binding when available.
			if (runtimeProvider === 'gcp') {
				const assetResponse = await serveAssetFromObjectStore(request, env);
				if (assetResponse) {
					return assetResponse;
				}
				logger.warn(`Asset not found in GCS for path: ${pathname}, falling back to legacy binding.`);
			}
			if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
				return env.ASSETS.fetch(request);
			}
			return new Response('Not Found', { status: 404 });
		}

		// Route 2: User App Request (e.g., xyz.build.cloudflare.dev or test.localhost)
		if (isSubdomainRequest) {
			return handleUserAppRequest(request, env, runtimeProvider);
		}

		return new Response('Not Found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;

export default worker;

// Wrap the entire worker with Sentry for comprehensive error monitoring.
// export default Sentry.withSentry(sentryOptions, worker);
