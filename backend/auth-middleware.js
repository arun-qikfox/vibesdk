/**
 * Express Authentication Middleware Adapter
 * Bridges Worker authentication logic to Express middleware
 */

const { adaptExpressToWorkerRequest } = require('./worker-service-adapter');

/**
 * Creates Express middleware that validates authentication using Worker auth logic
 */
function createAuthMiddleware() {
    return async function authMiddleware(req, res, next) {
        console.log(`🔒 AUTHENTICATE MIDDLEWARE CALLED for: ${req.path}`);
        const cookieKeys = Object.keys(req.cookies || {});
        console.log('All cookie keys received:', cookieKeys);
        console.log('Cookies values:', JSON.stringify(req.cookies, null, 2));

        try {
            // Skip auth check for auth routes themselves (login/register)
            if (req.path.startsWith('/api/auth/login') ||
                req.path.startsWith('/api/auth/register') ||
                req.path.startsWith('/api/auth/csrf-token')) {
                console.log('⏭️ Skipping auth for login/register routes');
                return next();
            }

            // Use the globally cached auth service (initialized at server startup)
            const authService = global.cachedAuthService;
            console.log('Auth service available:', !!authService);

            if (!authService) {
                console.warn('⚠️ Auth service not available, allowing request');
                return next();
            }

            // Check for access token in Authorization header first
            let accessToken = null;
            if (req.headers.authorization?.startsWith('Bearer ')) {
                accessToken = req.headers.authorization.substring(7);
                console.log('Found accessToken in Authorization header');
            }

            // Check for JWT access token in cookies
            if (!accessToken && req.cookies?.accessToken) {
                accessToken = req.cookies.accessToken;
                console.log('Found accessToken in cookies:', accessToken ? 'YES (set)' : 'NO (empty)');
            }

            // Also check for 'session' cookie
            if (!accessToken && req.cookies?.session) {
                console.log('Found session cookie but no accessToken, need JWT for validation');
            }

            if (!accessToken) {
                console.log('❌ No JWT access token found (checked both header and cookie)');
                console.log('Available cookies:', cookieKeys);
                console.log('Authorization header:', req.headers.authorization ? 'present' : 'missing');
                return next(); // Skip auth, let route handle it
            }

            console.log('✅ Found access token, attempting validation...');

            // Try to validate the JWT access token
            try {
                const sessionData = await validateUserSession(authService, accessToken);

                if (sessionData && sessionData.user) {
                    // Set authenticated user on request
                    req.user = sessionData.user;
                    req.sessionId = sessionData.sessionId;
                    console.log(`✅ Session validated for user: ${sessionData.user.email}`);
                    return next(); // Success - proceed with authenticated request
                } else {
                    console.log('⚠️ No valid session data returned');
                }
            } catch (validationError) {
                console.log(`⚠️ JWT validation failed: ${validationError.message}`);
                console.log(`⚠️ Full error:`, validationError);
            }

            // If we get here, validation failed
            console.log('❌ Authentication validation failed, clearing cookies');
            res.clearCookie('session');
            res.clearCookie('accessToken');
            return next(); // Continue without authentication
        } catch (error) {
            console.error('❌ Auth middleware error:', error.message);
            // Don't fail the request, just skip auth
            next();
        }
    };
}

/**
 * Helper function to validate JWT access tokens
 * Validates the JWT and retrieves user session data
 */
async function validateUserSession(authService, accessToken) {
    try {
        console.log('🔍 Validating JWT access token...');
        if (!accessToken) {
            console.log('❌ No access token provided to validation function');
            return null;
        }

        // Try to validate JWT token using the same method as AuthService
        const { JWTUtils } = await import('../worker/utils/jwtUtils');
        const jwtUtils = JWTUtils.getInstance({
            JWT_SECRET: process.env.JWT_SECRET || 'dev-secret'
        });

        // Verify JWT token and extract session info
        const decoded = await jwtUtils.verifyToken(accessToken);
        console.log('JWT decoded payload:', decoded);

        if (!decoded || !decoded.sub || !decoded.sessionId || decoded.type !== 'access') {
            console.log('❌ Invalid JWT payload or not access token:', decoded);
            return null;
        }

        // Get user data from database using AuthService
        const userData = await getUserFromDatabase(authService, decoded.sub);

        if (!userData) {
            console.log('❌ User not found for ID:', decoded.sub);
            return null;
        }

        return {
            user: {
                id: userData.id,
                email: userData.email,
                displayName: userData.displayName || userData.email.split('@')[0],
                username: userData.username,
                avatarUrl: userData.avatarUrl,
                bio: userData.bio || '',
                timezone: userData.timezone || 'UTC',
                provider: userData.provider || 'email',
                emailVerified: userData.emailVerified || false,
                createdAt: userData.createdAt
            },
            sessionId: decoded.sessionId
        };

    } catch (error) {
        console.error('❌ Session validation error:', error.message);
        console.error('Full error:', error);
        return null;
    }
}

/**
 * Helper to get user data from database
 */
async function getUserFromDatabase(authService, userId) {
    try {
        console.log('🔍 Querying database for user ID:', userId);

        // Use the database service from AuthService - access it properly
        const { eq } = await import('drizzle-orm');
        const { schema } = await import('../worker/database/schema.ts');

        const userData = await authService.database
            .select({
                id: schema.users.id,
                email: schema.users.email,
                displayName: schema.users.displayName,
                username: schema.users.username,
                avatarUrl: schema.users.avatarUrl,
                bio: schema.users.bio,
                timezone: schema.users.timezone,
                provider: schema.users.provider,
                emailVerified: schema.users.emailVerified,
                createdAt: schema.users.createdAt
            })
            .from(schema.users)
            .where(eq(schema.users.id, userId))
            .limit(1);

        console.log('Database query result:', userData.length > 0 ? 'User found' : 'User not found');
        return userData[0] || null;
    } catch (error) {
        console.error('❌ Error fetching user from database:', error.message);
        console.error('Full database error:', error);
        return null;
    }
}

module.exports = {
    createAuthMiddleware
};
