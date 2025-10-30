// Stub AuthController with complete authentication logic
// Simplified version that handles login/register/profile like your real AuthService

// Global mock user database - shared with middleware adapters
global.mockUserDatabase = global.mockUserDatabase || new Map();

class AuthController {
    // Real JWT and session validation - simplified for demo
    static async validateToken(token) {
        try {
            // Mock validation - in real implementation, use your JWTUtils
            if (token && token.startsWith('mock-')) {
                return {
                    id: 'mock-user-id',
                    email: 'user@example.com',
                    displayName: 'Mock User',
                    provider: 'email',
                    emailVerified: true
                };
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    static async register(request, env, ctx, routeContext) {
        try {
            const body = await request.json();
            const { email, password, name } = body;

            if (!email || !password) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Email and password are required'
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Mock user creation - simulate database insert
            const userId = 'user-' + Date.now();
            const mockUser = {
                id: userId,
                email: email.toLowerCase(),
                displayName: name || email.split('@')[0],
                emailVerified: true,
                provider: 'email'
            };

            // Store user data in mock database for retrieval later
            global.mockUserDatabase.set(userId, mockUser);

            // Create session like your AuthService does
            const sessionId = 'session-' + userId;
            const response = new Response(JSON.stringify({
                success: true,
                data: {
                    user: mockUser,
                    accessToken: 'mock-jwt-token-' + userId,
                    sessionId: sessionId,
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
                }
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

            // Set HTTP-only cookie - CRITICAL for frontend auth detection
            response.headers.set('Set-Cookie',
                `session=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${24 * 60 * 60}`);

            return response;

        } catch (error) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Registration failed'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    static async login(request, env, ctx, routeContext) {
        try {
            const body = await request.json();
            const { email, password } = body;

            if (!email || !password) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Email and password are required'
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Mock authentication - in real implementation, validate password hash
            const mockUser = {
                id: 'user-' + Date.now(),
                email: email.toLowerCase(),
                displayName: email.split('@')[0],
                emailVerified: true,
                provider: 'email'
            };

            // Store user data in mock database for retrieval later
            global.mockUserDatabase.set(mockUser.id, mockUser);

            const sessionId = 'session-' + mockUser.id;
            const response = new Response(JSON.stringify({
                success: true,
                data: {
                    user: mockUser,
                    accessToken: 'mock-jwt-token-' + mockUser.id,
                    sessionId: sessionId,
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
                }
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

            // Set session cookie - frontend looks for this!
            response.headers.set('Set-Cookie',
                `session=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${24 * 60 * 60}`);

            return response;

        } catch (error) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Login failed'
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    static async getProfile(request, env, ctx, routeContext) {
        // THIS IS THE CRITICAL METHOD for AuthContext.checkAuth()

        // If no user in routeContext, return 401 - this tells AuthContext user is NOT authenticated
        // The signin form will show!
        if (!routeContext.user) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Authentication required'
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // User is authenticated - return profile data
        return new Response(JSON.stringify({
            success: true,
            data: {
                user: routeContext.user,
                sessionId: routeContext.sessionId
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    static async logout(request, env, ctx, routeContext) {
        const response = new Response(JSON.stringify({
            success: true,
            data: { message: 'Logged out successfully' }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

        // Clear session cookie - this will make getProfile return 401
        response.headers.set('Set-Cookie',
            'session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');

        return response;
    }

    // Stub implementations for other methods to prevent errors
    static async getCsrfToken() {
        return new Response(JSON.stringify({
            success: true,
            data: { token: 'stub-csrf-token-' + Date.now() }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    static async getAuthProviders() {
        return new Response(JSON.stringify({
            success: true,
            data: {
                providers: { google: true, github: false, email: true },
                hasOAuth: true,
                requiresEmailAuth: true
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    static async checkAuth() {
        return new Response(JSON.stringify({
            success: true,
            data: { authenticated: false, user: null }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    static async verifyEmail() {
        return new Response(JSON.stringify({
            success: true,
            data: { message: 'Email verified (stub)' }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    static async resendVerificationOtp() {
        return new Response(JSON.stringify({
            success: true,
            data: { message: 'OTP sent (stub)' }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    static async updateProfile() {
        return new Response(JSON.stringify({
            success: true,
            data: { message: 'Profile updated (stub)' }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    static async initiateOAuth() {
        return new Response(null, { status: 302, headers: { 'Location': '/' } });
    }

    static async handleOAuthCallback() {
        return new Response(null, { status: 302, headers: { 'Location': '/' } });
    }

    static async getActiveSessions() {
        return new Response(JSON.stringify({
            success: true,
            data: { sessions: [] }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    static async revokeSession() {
        return new Response(JSON.stringify({
            success: true,
            data: { message: 'Session revoked (stub)' }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

module.exports = {
    AuthController
};
