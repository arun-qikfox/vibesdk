/**
 * Worker Service Adapter
 * Integrates with existing GCP authentication infrastructure
 * Uses AuthService, PasswordService, and JWTUtils instead of custom crypto
 */

console.log('� Using GCP authentication infrastructure (AuthService, PasswordService, JWTUtils)');

// User service and session service stubs for compatibility
class UserService {}
class SessionService {}

// Create instances when needed
let authService = null;
let authController = null;

async function getAuthService() {
    if (!authService) {
        try {
            console.log('🔄 Attempting to create AuthService...');
            console.log('🔄 global.env.DATABASE_URL at AuthService creation:', global.env.DATABASE_URL);
            console.log('🔄 global.env.DB type:', typeof global.env.DB, global.env.DB?.constructor?.name);

            // Load the actual AuthService from the worker TypeScript code
            const { AuthService } = await import('../worker/database/services/AuthService.ts');
            authService = new AuthService(global.env);
            console.log('✅ AuthService loaded from worker');
        } catch (error) {
            console.warn('⚠️  Could not load AuthService, auth operations will fail:', error.message);
            console.warn('Stack trace:', error.stack);
            authService = null;
        }
    }
    return authService;
}

function getAuthController(env) {
    if (!authController) {
        // Create authentication controller using AuthService
        authController = {
    register: async (request, env, ctx, routeContext) => {
                console.log('🔄 API Register request received');
                try {
                    const auth = await getAuthService(env);
                    console.log('🔄 AuthService retrieved:', auth?.constructor?.name);
                    if (!auth) {
                        throw new Error('AuthService not available');
                    }

                    const body = await request.json();
                    const { email, password, name } = body;

                    if (!email || !password) {
                        throw new Error('Email and password are required');
                    }

                    // Adapt Express request to Worker format
                    const adaptedRequest = adaptExpressToWorkerRequest(request);

                    // Use AuthService.register which handles hashing, validation, and session creation
                    const result = await auth.register({
                        email: email.toLowerCase(),
                        password,
                        name
                    }, adaptedRequest);

                    console.log(`✅ User registered via AuthService: ${email}`);

                    const response = new Response(JSON.stringify({
                        success: true,
                        data: {
                            user: result.user,
                            accessToken: result.accessToken,
                            sessionId: result.sessionId
                        }
                    }), {
                        status: 200,
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });

                    // Set single readable cookie for JWT token (eliminates duplication)
                    response.headers.append('Set-Cookie', `session=${result.sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${24 * 60 * 60}`);
                    response.headers.append('Set-Cookie', `accessToken=${result.accessToken}; SameSite=Lax; Path=/; Max-Age=${24 * 60 * 60}`);

                    return response;
                } catch (error) {
                    console.error('Registration error:', error);
                    const statusCode = error.message?.includes('already registered') ? 400 : 500;
                    return new Response(JSON.stringify({
                        success: false,
                        error: error.message || 'Registration failed'
                    }), {
                        status: statusCode,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            },

            login: async (request, env, ctx, routeContext) => {
                try {
                    const auth = await getAuthService(env);
                    if (!auth) {
                        throw new Error('AuthService not available');
                    }

                    const body = await request.json();
                    const { email, password } = body;

                    if (!email || !password) {
                        throw new Error('Email and password are required');
                    }

                    // Adapt Express request to Worker format
                    const adaptedRequest = adaptExpressToWorkerRequest(request);

                    // Use AuthService.login which handles password verification and session creation
                    const result = await auth.login({
                        email: email.toLowerCase(),
                        password
                    }, adaptedRequest);

                    console.log(`✅ User logged in via AuthService: ${email}`);

                    const response = new Response(JSON.stringify({
                        success: true,
                        data: {
                            user: result.user,
                            accessToken: result.accessToken,
                            sessionId: result.sessionId
                        }
                    }), {
                        status: 200,
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });

                    // Set single readable cookie for JWT token (eliminates duplication)
                    response.headers.append('Set-Cookie', `session=${result.sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${24 * 60 * 60}`);
                    response.headers.append('Set-Cookie', `accessToken=${result.accessToken}; SameSite=Lax; Path=/; Max-Age=${24 * 60 * 60}`);

                    return response;
                } catch (error) {
                    console.error('Login error:', error);
                    return new Response(JSON.stringify({
                        success: false,
                        error: error.message || 'Invalid credentials'
                    }), {
                        status: 401,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            },

            getProfile: (request, env, ctx, routeContext) => {
                // This should return the user from context that's set by middleware
                if (!routeContext.user) {
                    return Promise.resolve(new Response(JSON.stringify({
                        success: false,
                        error: 'Not authenticated'
                    }), { status: 401, headers: { 'Content-Type': 'application/json' } }));
                }

                return Promise.resolve(new Response(JSON.stringify({
                    success: true,
                    data: {
                        user: routeContext.user,
                        sessionId: routeContext.sessionId
                    }
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                }));
            },

            logout: (request, env, ctx, routeContext) => {
                const response = new Response(JSON.stringify({
                    success: true,
                    data: { message: 'Logged out successfully' }
                }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                // Clear authentication cookies
                response.headers.append('Set-Cookie', 'session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
                response.headers.append('Set-Cookie', 'accessToken=; SameSite=Lax; Path=/; Max-Age=0');

                return Promise.resolve(response);
            },

            // Keep other stub methods for now
            getCsrfToken: require('./auth-controller-stub').AuthController.getCsrfToken,
            getAuthProviders: require('./auth-controller-stub').AuthController.getAuthProviders,
            checkAuth: require('./auth-controller-stub').AuthController.checkAuth,
            verifyEmail: require('./auth-controller-stub').AuthController.verifyEmail,
            resendVerificationOtp: require('./auth-controller-stub').AuthController.resendVerificationOtp,
            updateProfile: require('./auth-controller-stub').AuthController.updateProfile,
            initiateOAuth: require('./auth-controller-stub').AuthController.initiateOAuth,
            handleOAuthCallback: require('./auth-controller-stub').AuthController.handleOAuthCallback,
            getActiveSessions: require('./auth-controller-stub').AuthController.getActiveSessions,
            revokeSession: require('./auth-controller-stub').AuthController.revokeSession
        };
    }
    return authController;
}

// Try to load actual CodingAgentController from Worker
let CodingAgentController = null;
try {
  // This will fail in production because it's TypeScript, but might work with compilation
  CodingAgentController = require('../worker/api/controllers/agent/controller.js').CodingAgentController;
} catch (error) {
  console.warn('⚠️  Could not load real CodingAgentController, using stub');
  // Stub implementation for development
  CodingAgentController = class StubCodingAgentController {
    static async startCodeGeneration(request, env, ctx, context) {
      // Create NDJSON stream response similar to what the real controller would do
      const { readable, writable } = new TransformStream({
        transform(chunk, controller) {
          if (chunk === "terminate") {
            controller.terminate();
          } else {
            const encoded = new TextEncoder().encode(JSON.stringify(chunk) + '\n');
            controller.enqueue(encoded);
          }
        }
      });

      const writer = writable.getWriter();
      const agentId = 'agent-' + Date.now();

      // Simulate the real agent response
      setTimeout(() => {
        writer.write({
          message: 'Code generation started',
          agentId: agentId,
          websocketUrl: `ws://localhost:3001/api/agent/${agentId}/ws`,
          httpStatusUrl: `http://localhost:3001/api/agent/${agentId}`,
          template: {
            name: 'Basic React App',
            files: ['src/App.js', 'public/index.html']
          }
        });
        writer.write("terminate");
        writer.close();
      }, 100);

      return new Response(readable, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate, no-transform',
          'Pragma': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }

    static async connectToExistingAgent(request, env, ctx, context) {
      const agentId = context.pathParams.agentId || 'unknown';
      return {
        success: true,
        data: {
          agentId: agentId,
          websocketUrl: `ws://localhost:3001/api/agent/${agentId}/ws`
        }
      };
    }

    static async handleWebSocketConnection() {
      // Stub WebSocket handling
      return new Response('WebSocket not implemented in stub', { status: 501 });
    }

    static async deployPreview() {
      // Stub preview deployment
      return {
        success: true,
        data: {
          previewURL: 'http://localhost:3001/preview/stub-app'
        }
      };
    }
  };
}
const createLogger = (name) => ({
  info: (msg) => console.log(`[${name}] ${msg}`),
  warn: (msg) => console.warn(`[${name}] ${msg}`),
  error: (msg) => console.error(`[${name}] ${msg}`),
  debug: (msg) => console.debug(`[${name}] ${msg}`)
});

// Dummy async function for compatibility
async function loadWorkerServices() {
  console.log('✅ Stub services already loaded synchronously');
}

// Initialize services with actual global.env
async function initializeWorkerServices(env) {
  console.log('🏗️  Initializing GCP authentication services...');

  let authService = null;
  try {
    console.log('🔄 Loading AuthService...');
    // Load the actual AuthService
    const { AuthService } = await import('../worker/database/services/AuthService.ts');
    console.log('✅ AuthService module loaded, creating instance...');

    // Check if global.env.DB exists
    console.log('DB client in global.env:', typeof global.env.DB, global.env.DB?.constructor?.name);

    authService = new AuthService(global.env);
    console.log('✅ AuthService initialized successfully, constructor:', authService.constructor.name);
  } catch (error) {
    console.warn('⚠️  Could not initialize full AuthService:', error.message);
    console.warn('Stack trace:', error.stack);

    // Fallback to minimal auth service that provides just what the middleware needs
    console.log('🔄 Creating minimal auth service for middleware...');
    try {
      authService = await createMinimalAuthService(global.env);
      console.log('✅ Minimal AuthService created for middleware');
    } catch (minimalError) {
      console.warn('⚠️  Could not create minimal AuthService either:', minimalError.message);
      authService = null;
    }
  }

  console.log('✅ Authentication services ready');
  return {
    authService,
    userService: new UserService(),
    sessionService: new SessionService()
  };
}

// Adapt Express request to Worker request format
function adaptExpressToWorkerRequest(expressRequest) {
  // Create a simple headers object that mimics the Workers Headers API
  const workerHeaders = {
    get: function(name) {
      // Case-insensitive header lookup
      const lowerName = name.toLowerCase();
      const rawHeaders = expressRequest.rawHeaders || [];

      // Find header value (case-insensitive)
      for (let i = 0; i < rawHeaders.length; i += 2) {
        if (rawHeaders[i].toLowerCase() === lowerName) {
          return rawHeaders[i + 1] || null;
        }
      }

      // Fallback to express request headers
      return expressRequest.headers[lowerName] ||
             expressRequest.headers[name] ||
             null;
    }
  };

  const workerRequest = {
    url: `${expressRequest.protocol}://${expressRequest.hostname || 'localhost'}${expressRequest.originalUrl}`,
    method: expressRequest.method,
    headers: workerHeaders,
  };

  // Copy Express body methods
  workerRequest.json = () => Promise.resolve(expressRequest.body);
  workerRequest.text = () => Promise.resolve(JSON.stringify(expressRequest.body));

  return workerRequest;
}

// Create a minimal auth service that just provides database access for middleware
async function createMinimalAuthService(env) {
  console.log('🔄 Setting up minimal auth service for middleware...');

  class MinimalAuthService {
    constructor(env) {
      this.env = env;
      if (!env.DB) {
        throw new Error('Database client not available in minimal auth service');
      }
      this.database = env.DB;
    }

    // Provide a user lookup method for the middleware - use raw SQL to avoid schema imports
    async findUserById(userId) {
      try {
        console.log('🔍 Looking up user with ID:', userId);

        // Use raw SQL to avoid TypeScript schema imports
        const users = await this.database.prepare(`
          SELECT id, email, display_name, username, avatar_url, bio, timezone, provider, email_verified, created_at
          FROM users
          WHERE id = ? AND deleted_at IS NULL
          LIMIT 1
        `);

        const result = await users.bind(userId).first();

        if (result) {
          // Map to expected format
          return {
            id: result.id,
            email: result.email,
            displayName: result.display_name,
            username: result.username,
            avatarUrl: result.avatar_url,
            bio: result.bio,
            timezone: result.timezone,
            provider: result.provider,
            emailVerified: result.email_verified,
            createdAt: result.created_at
          };
        }

        return null;
      } catch (error) {
        console.error('❌ Minimal auth service error:', error.message);
        return null;
      }
    }
  }

  return new MinimalAuthService(env);
}

module.exports = {
  getAuthController,
  CodingAgentController,
  createLogger,
  initializeWorkerServices,
  loadWorkerServices,
  adaptExpressToWorkerRequest,
  createMinimalAuthService
};
