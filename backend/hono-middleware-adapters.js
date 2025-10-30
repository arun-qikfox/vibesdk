// Hono Middleware Adapters
// Bridges existing Worker middleware to work with Hono Node.js

const { createMiddleware } = require('hono/factory');
const { formatApiResponse } = require('./api-client-router');

// Simplified authentication - not using complex service imports for now

// Mock user database for development testing
// This stores user data created during registration so it can be retrieved later
const mockUserDatabase = new Map();

// For compatibility, use actual service imports where possible
let extractToken, RateLimitService, getUserConfigurableSettings;
try {
    extractToken = require('../worker/utils/authUtils').extractToken;
    RateLimitService = require('../worker/services/rate-limit/rateLimits').RateLimitService;
    getUserConfigurableSettings = require('../worker/config').getUserConfigurableSettings;
} catch (error) {
    console.warn('Some Worker utilities not loaded:', error.message);
    extractToken = (header) => null;
    RateLimitService = { enforceAuthRateLimit: async () => {} };
    getUserConfigurableSettings = async () => ({ security: { rateLimit: 100 } });
}

let adapters = null;

/**
 * Initialize middleware adapters with global environment
 * @param {Object} globalEnv - Global environment with services
 */
function initializeMiddlewareAdapters(globalEnv) {
    if (adapters) return adapters;

    adapters = {
        /**
         * Simplified JWT-based authentication middleware - decodes JWT token
         */
        authenticate: createMiddleware(async (c, next) => {
            console.log('🔒 AUTHENTICATE MIDDLEWARE CALLED for:', c.req.path);

            try {
                // Extract JWT token from Authorization header (Bearer token)
                const authHeader = c.req.header('Authorization');
                let token = null;

                if (authHeader?.startsWith('Bearer ')) {
                    token = authHeader.substring(7);
                }

                if (!token) {
                    console.log('❌ No JWT token found - returning 401');
                    return c.json(formatApiResponse('Authentication required', false), 401);
                }

                console.log('✅ Token found, decoding...');

                // Decode JWT token manually (simple verification for development)
                const jwt = require('jsonwebtoken');
                const jwtSecret = process.env.JWT_SECRET || 'dev-secret-key';

                try {
                    const decoded = jwt.verify(token, jwtSecret);
                    console.log('✅ JWT decoded:', decoded.sub);

                    // Get user from our database
                    const { db } = require('./worker-service-adapter').db;
                    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.sub);

                    if (!user) {
                        console.log('❌ User not found in database');
                        return c.json(formatApiResponse('User not found', false), 401);
                    }

                    const userData = {
                        id: user.id,
                        email: user.email,
                        displayName: user.displayName,
                        provider: user.provider,
                        emailVerified: !!user.emailVerified
                    };

                    console.log('✅ User authenticated:', userData.id, 'Email:', userData.email);

                    // Set user context like worker does
                    c.set('user', userData);
                    c.set('sessionId', user.id);

                    await next();

                } catch (jwtError) {
                    console.log('❌ JWT verification failed:', jwtError.message);
                    return c.json(formatApiResponse('Invalid token', false), 401);
                }

            } catch (error) {
                console.error('❌ Authentication error:', error);
                return c.json(formatApiResponse('Authentication failed', false), 401);
            }
        }),

        /**
         * Route auth level setter - stores auth requirements in context
         * Adapted from worker/middleware/auth/routeAuth.ts setAuthLevel
         */
        setAuthLevel: (requirement) => {
            return createMiddleware(async (c, next) => {
                c.set('authLevel', requirement);
                await next();
            });
        },

        /**
         * Auth level enforcement middleware - checks based on authLevel
         * Adapted from worker/middleware/auth/routeAuth.ts enforceAuthRequirement
         */
        enforceAuthRequirement: createMiddleware(async (c, next) => {
            const requirement = c.get('authLevel');
            if (!requirement) {
                return c.json(formatApiResponse('No authentication level defined', false), 500);
            }

            // For public routes, always proceed
            if (requirement.level === 'public') {
                return next();
            }

            // For authenticated routes, validate user exists
            if (requirement.level === 'authenticated') {
                const user = c.get('user');
                if (!user) {
                    return c.json(formatApiResponse('Authentication required', false), 401);
                }
                return next();
            }

            // For owner-only routes, check ownership
            if (requirement.level === 'owner-only') {
                const user = c.get('user');
                if (!user) {
                    return c.json(formatApiResponse('Authentication required', false), 401);
                }

                // Check resource ownership if required
                if (requirement.resourceOwnershipCheck) {
                    const params = c.req.param();
                    const isOwner = await requirement.resourceOwnershipCheck(user, params, globalEnv);
                    if (!isOwner) {
                        return c.json(formatApiResponse('Access denied - not owner', false), 403);
                    }
                }

                return next();
            }

            await next();
        }),

        /**
         * Controller method executor - calls controller methods with proper context
         * Adapted from worker/api/honoAdapter.ts adaptController
         */
        adaptController: (controllerClass, controllerMethod) => {
            return createMiddleware(async (c) => {
                try {
                    // Build route context like worker does
                    const routeContext = {
                        user: c.get('user'),
                        sessionId: c.get('sessionId'),
                        config: c.get('config'),
                        pathParams: c.req.param(),
                        queryParams: new URL(c.req.url).searchParams,
                    };

                    // Call controller method like worker does
                    const result = await controllerMethod.call(
                        controllerClass,
                        c.req.raw,           // Request object
                        globalEnv,           // Environment
                        {},                  // Execution context (mock for Node.js)
                        routeContext         // Route context with user/session
                    );

                    // Return the Response from controller (worker format)
                    return result;

                } catch (error) {
                    console.error('Controller execution error:', error);
                    return c.json(formatApiResponse('Controller error', false), 500);
                }
            });
        },

        /**
         * Error handling middleware
         */
        errorHandler: createMiddleware(async (c, next) => {
            try {
                await next();
            } catch (error) {
                console.error('Route error:', error);
                return c.json(formatApiResponse('Internal server error', false), 500);
            }
        }),

        // Services for route handlers to use
        services: {}
    };

    return adapters;
}

module.exports = {
    initializeMiddlewareAdapters
};
