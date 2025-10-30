// Clean replacement for setup-hono-routes.js
// Setup Hono Routes - Mirrors Worker route setup exactly

// Use actual Worker controllers loaded by service adapter
const { getAuthController, CodingAgentController } = require('./worker-service-adapter');

// Simple logger
const createLogger = (name) => ({
    info: (msg) => console.log(`[${name}] ${msg}`),
    debug: (msg) => console.debug(`[${name}] ${msg}`),
    warn: (msg) => console.warn(`[${name}] ${msg}`),
    error: (msg) => console.error(`[${name}] ${msg}`)
});

/**
 * Authentication configuration constants
 */
const AuthConfig = {
    public: { required: false, level: 'public' },
    authenticated: { required: true, level: 'authenticated' },
    ownerOnly: { required: true, level: 'owner-only' },
    publicReadOwnerWrite: { required: false }
};

async function checkAppOwnership(user, params, env) {
    return true; // Placeholder
}

/**
 * Setup all routes to mirror Worker configuration
 * @param {Hono} app - Hono app instance
 * @param {Object} honoAdapters - Middleware adapters
 */
async function setupHonoCompatibleRoutes(app, honoAdapters) {
    const logger = createLogger('HonoRoutes');

    try {
        console.log('🔗 Setting up authentication routes...');

        // Get the auth controller with access to real AuthService
        const AuthController = getAuthController();

        // ======================================
        // AUTHENTICATION ROUTES
        // ======================================

        // CSRF token - no auth required
        app.get('/api/auth/csrf-token',
            honoAdapters.setAuthLevel(AuthConfig.public),
            honoAdapters.enforceAuthRequirement,
            honoAdapters.adaptController(AuthController, AuthController.getCsrfToken)
        );

        // Auth providers - no auth required
        app.get('/api/auth/providers',
            honoAdapters.setAuthLevel(AuthConfig.public),
            honoAdapters.enforceAuthRequirement,
            honoAdapters.adaptController(AuthController, AuthController.getAuthProviders)
        );

        // Register - no auth required (but needs CSRF protection)
        app.post('/api/auth/register',
            honoAdapters.setAuthLevel(AuthConfig.public),
            honoAdapters.enforceAuthRequirement,
            honoAdapters.adaptController(AuthController, AuthController.register)
        );

        // Login - no auth required
        app.post('/api/auth/login',
            honoAdapters.setAuthLevel(AuthConfig.public),
            honoAdapters.enforceAuthRequirement,
            honoAdapters.adaptController(AuthController, AuthController.login)
        );

        // Email verification - no auth required
        app.post('/api/auth/verify-email',
            honoAdapters.setAuthLevel(AuthConfig.public),
            honoAdapters.enforceAuthRequirement,
            honoAdapters.adaptController(AuthController, AuthController.verifyEmail)
        );

        app.post('/api/auth/resend-verification',
            honoAdapters.setAuthLevel(AuthConfig.public),
            honoAdapters.enforceAuthRequirement,
            honoAdapters.adaptController(AuthController, AuthController.resendVerificationOtp)
        );

        // Auth check - no auth required
        app.get('/api/auth/check',
            honoAdapters.setAuthLevel(AuthConfig.public),
            honoAdapters.enforceAuthRequirement,
            honoAdapters.adaptController(AuthController, AuthController.checkAuth)
        );

        // CRITICAL: Profile endpoint requires authentication
        // This is called by AuthContext.checkAuth() to determine if user is logged in
        // If unauthenticated, it should return 401 to make signin form show!
        console.log('🔗 Registering /api/auth/profile route with authenticate middleware');
        app.get('/api/auth/profile',
            honoAdapters.authenticate,  // Use direct authenticate middleware
            honoAdapters.adaptController(AuthController, AuthController.getProfile)
        );

        app.put('/api/auth/profile',
            honoAdapters.authenticate,
            honoAdapters.adaptController(AuthController, AuthController.updateProfile)
        );

        app.post('/api/auth/logout',
            honoAdapters.authenticate,
            honoAdapters.adaptController(AuthController, AuthController.logout)
        );

        // OAuth routes
        app.get('/api/auth/oauth/:provider',
            honoAdapters.setAuthLevel(AuthConfig.public),
            honoAdapters.enforceAuthRequirement,
            honoAdapters.adaptController(AuthController, AuthController.initiateOAuth)
        );

        app.get('/api/auth/callback/:provider',
            honoAdapters.setAuthLevel(AuthConfig.public),
            honoAdapters.enforceAuthRequirement,
            honoAdapters.adaptController(AuthController, AuthController.handleOAuthCallback)
        );

        // Session management requires authentication
        app.get('/api/auth/sessions',
            honoAdapters.authenticate,
            honoAdapters.adaptController(AuthController, AuthController.getActiveSessions)
        );

        app.delete('/api/auth/sessions/:sessionId',
            honoAdapters.authenticate,
            honoAdapters.adaptController(AuthController, AuthController.revokeSession)
        );

        console.log('✅ Authentication routes configured');

        // ======================================
        // APP AND OTHER ROUTES
        // ======================================

        app.get('/api/apps', honoAdapters.authenticate, (c) => {
            const user = c.get('user');
            return c.json(require('./api-client-router').formatApiResponse([{
                id: 'app-123',
                title: 'Sample App',
                status: 'completed',
                createdAt: new Date().toISOString()
            }]));
        });

        app.post('/api/apps', honoAdapters.authenticate, (c) => {
            const user = c.get('user');
            return c.json(require('./api-client-router').formatApiResponse({
                id: 'app-' + Date.now(),
                title: 'New App',
                status: 'generating'
            }));
        });

        app.get('/api/user/apps', honoAdapters.authenticate, (c) => {
            return c.json(require('./api-client-router').formatApiResponse({
                apps: [],
                pagination: { page: 1, total: 0 }
            }));
        });

        // Use real AgentController from Worker - start code generation
        app.post('/api/agent',
            honoAdapters.authenticate,
            honoAdapters.adaptController(CodingAgentController, CodingAgentController.startCodeGeneration)
        );

        // Use real AgentController - connect to existing agent
        app.get('/api/agent/:agentId/connect',
            honoAdapters.authenticate,
            honoAdapters.adaptController(CodingAgentController, CodingAgentController.connectToExistingAgent)
        );

        app.get('/api/model-configs', honoAdapters.authenticate, (c) => {
            return c.json(require('./api-client-router').formatApiResponse([{
                actionKey: 'generate_app',
                provider: 'openai',
                model: 'gpt-4',
                temperature: 0.7
            }]));
        });

        console.log('✅ All routes configured');
        logger.info('Hono routes setup complete');

    } catch (error) {
        console.error('❌ Failed to setup Hono routes:', error);
        throw error;
    }
}

module.exports = {
    setupHonoCompatibleRoutes,
    AuthConfig
};
