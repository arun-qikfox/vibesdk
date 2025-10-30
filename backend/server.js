const express = require('express');
const cors = require('cors');
const { setupGlobalEnvironment } = require('./setup-env');

// Create Express application
const app = express();
const PORT = process.env.PORT || 3001;

// Setup global environment and start server
(async () => {
    try {
        console.log('🚀 Initializing global environment...');
        await setupGlobalEnvironment();
        console.log('✅ Global environment initialized');

        // Middleware
        app.use(cors({
            origin: ['http://localhost:5173', 'http://localhost:3000'], // Vite dev server
            credentials: true,
        }));
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        // Basic error handling middleware
        app.use((error, req, res, next) => {
            console.error(error.stack);
            res.status(500).json({
                success: false,
                error: { message: 'Internal server error', type: 'INTERNAL_ERROR' }
            });
        });

        // ============================================================================
        // AUTHENTICATION ROUTES - Using Real Worker Services
        // ============================================================================

        const { getAuthController } = require('./worker-service-adapter');

        // Get the actual auth controller with real AuthService
        const authController = await getAuthController({
            DATABASE_URL: process.env.DATABASE_URL,
            JWT_SECRET: process.env.JWT_SECRET || 'dev-secret',
            RUNTIME_PROVIDER: process.env.RUNTIME_PROVIDER || 'gcp'
        });

// GET /api/auth/csrf-token
app.get('/api/auth/csrf-token', (req, res) => {
    res.json({
        success: true,
        data: {
            token: 'placeholder-csrf-token-' + Date.now(),
            expiresIn: 7200
        }
    });
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    try {
        console.log('🔄 Login request received');
        const result = await authController.login({
            method: 'POST',
            json: () => Promise.resolve(req.body)
        });
        const data = await result.json();
        console.log('✅ Login handled by AuthService');
        res.json(data);
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication failed'
        });
    }
});

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
    try {
        console.log('🔄 Registration request received');
        const result = await authController.register({
            method: 'POST',
            json: () => Promise.resolve(req.body)
        });
        const data = await result.json();
        console.log('✅ Registration handled by AuthService');
        res.json(data);
    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Registration failed'
        });
    }
});

// GET /api/auth/profile
app.get('/api/auth/profile', (req, res) => {
    res.json({
        success: true,
        data: {
            id: 'user-123',
            email: 'user@example.com',
            displayName: 'Test User',
            bio: 'Test user bio',
            role: 'user',
            createdAt: new Date().toISOString(),
            theme: 'system',
            timezone: 'UTC'
        }
    });
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
    res.json({
        success: true,
        data: { message: 'Logged out successfully' }
    });
});

// GET /api/auth/sessions
app.get('/api/auth/sessions', (req, res) => {
    res.json({
        success: true,
        data: [
            {
                id: 'session-123',
                deviceInfo: 'Web Browser',
                ipAddress: '127.0.0.1',
                lastActiveAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                current: true
            }
        ]
    });
});

// DELETE /api/auth/sessions/:sessionId
app.delete('/api/auth/sessions/:sessionId', (req, res) => {
    res.json({
        success: true,
        data: { message: 'Session revoked successfully' }
    });
});

// GET /api/auth/api-keys
app.get('/api/auth/api-keys', (req, res) => {
    res.json({
        success: true,
        data: []
    });
});

// POST /api/auth/api-keys
app.post('/api/auth/api-keys', (req, res) => {
    const { name } = req.body;
    res.json({
        success: true,
        data: {
            key: 'vibesdk_' + Math.random().toString(36).substr(2, 20),
            keyPreview: 'vibedsk_xxxxx',
            name,
            message: 'API key created successfully'
        }
    });
});

// DELETE /api/auth/api-keys/:keyId
app.delete('/api/auth/api-keys/:keyId', (req, res) => {
    res.json({
        success: true,
        data: { message: 'API key revoked successfully' }
    });
});

// GET /api/auth/providers
app.get('/api/auth/providers', (req, res) => {
    res.json({
        success: true,
        data: {
            available: ['google', 'github'],
            configured: [],
            oauthUrls: {}
        }
    });
});

// ========================================================================
// PLATFORM STATUS
// ========================================================================

// GET /api/status
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'healthy',
            version: '1.0.0',
            services: {
                database: true,
                ai: true,
                storage: true
            }
        }
    });
});

// ========================================================================
// APPS MANAGEMENT
// ========================================================================

// GET /api/apps
app.get('/api/apps', (req, res) => {
    res.json({
        success: true,
        data: [
            {
                id: 'app-123',
                title: 'Sample App',
                description: 'A sample application',
                visibility: 'private',
                framework: 'react',
                status: 'completed',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ]
    });
});

// GET /api/apps/recent
app.get('/api/apps/recent', (req, res) => {
    res.json({
        success: true,
        data: [
            {
                id: 'app-123',
                title: 'Sample App',
                description: 'A sample application',
                visibility: 'private',
                framework: 'react',
                status: 'completed',
                createdAt: new Date().toISOString()
            }
        ]
    });
});

// GET /api/apps/favorites
app.get('/api/apps/favorites', (req, res) => {
    res.json({
        success: true,
        data: []
    });
});

// GET /api/apps/public
app.get('/api/apps/public', (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    res.json({
        success: true,
        data: {
            apps: [
                {
                    id: 'public-app-123',
                    title: 'Public Sample App',
                    description: 'A public application',
                    visibility: 'public',
                    framework: 'react',
                    status: 'completed',
                    author: {
                        id: 'user-456',
                        displayName: 'Public User',
                        username: 'publicuser'
                    },
                    stats: {
                        stars: 0,
                        forks: 0,
                        views: 0
                    },
                    createdAt: new Date().toISOString()
                }
            ],
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: 1,
                totalPages: 1
            }
        }
    });
});

// POST /api/apps
app.post('/api/apps', (req, res) => {
    const { title, description } = req.body;
    res.json({
        success: true,
        data: {
            id: 'app-' + Math.random().toString(36).substr(2, 9),
            title,
            description,
            visibility: 'private',
            status: 'generating',
            createdAt: new Date().toISOString()
        }
    });
});

// GET /api/apps/:id
app.get('/api/apps/:id', (req, res) => {
    const { id } = req.params;
    res.json({
        success: true,
        data: {
            id,
            title: 'Sample App',
            description: 'A detailed app view',
            visibility: 'private',
            framework: 'react',
            status: 'completed',
            code: '// Generated code here',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            author: {
                id: 'user-123',
                displayName: 'Test User'
            }
        }
    });
});

// DELETE /api/apps/:id
app.delete('/api/apps/:id', (req, res) => {
    res.json({
        success: true,
        data: { message: 'App deleted successfully' }
    });
});

// POST /api/apps/:id/favorite
app.post('/api/apps/:id/favorite', (req, res) => {
    res.json({
        success: true,
        data: {
            id: req.params.id,
            isFavorite: true,
            favoritesCount: 1
        }
    });
});

// PUT /api/apps/:id/visibility
app.put('/api/apps/:id/visibility', (req, res) => {
    const { visibility } = req.body;
    res.json({
        success: true,
        data: {
            id: req.params.id,
            visibility
        }
    });
});

// POST /api/apps/:id/star
app.post('/api/apps/:id/star', (req, res) => {
    res.json({
        success: true,
        data: {
            id: req.params.id,
            isStarred: true,
            starsCount: 1
        }
    });
});

// ========================================================================
// USER MANAGEMENT
// ========================================================================

// GET /api/user/apps
app.get('/api/user/apps', (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    res.json({
        success: true,
        data: {
            apps: [
                {
                    id: 'app-123',
                    title: 'My App',
                    description: 'User created app',
                    visibility: 'private',
                    framework: 'react',
                    status: 'completed',
                    createdAt: new Date().toISOString()
                }
            ],
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: 1,
                totalPages: 1
            }
        }
    });
});

// PUT /api/user/profile
app.put('/api/user/profile', (req, res) => {
    const updates = req.body;
    res.json({
        success: true,
        data: {
            ...updates,
            updatedAt: new Date().toISOString()
        }
    });
});

// ========================================================================
// AGENT/CODE GENERATION
// ========================================================================

// POST /api/agent
app.post('/api/agent', async (req, res) => {
    const { prompt, framework } = req.body;

    // Simulate streaming response for code generation
    res.setHeader('Content-Type', 'application/json');

    // Mock successful agent creation
    res.json({
        success: true,
        data: {
            agentId: 'agent-' + Math.random().toString(36).substr(2, 9),
            status: 'completed',
            app: {
                id: 'generated-app-' + Math.random().toString(36).substr(2, 9),
                title: 'Generated App',
                description: prompt,
                code: '// Generated code will appear here',
                framework: framework || 'react'
            }
        }
    });
});

// GET /api/agent/:id/connect
app.get('/api/agent/:id/connect', (req, res) => {
    const { id } = req.params;
    res.json({
        success: true,
        data: {
            agentId: id,
            connectionId: 'conn-' + Math.random().toString(36).substr(2, 9),
            status: 'connected'
        }
    });
});

// GET /api/agent/:id/preview
app.get('/api/agent/:id/preview', (req, res) => {
    res.json({
        success: true,
        data: {
            previewUrl: 'http://localhost:3000/preview/' + req.params.id
        }
    });
});

// GET /api/agent/:id/analytics
app.get('/api/agent/:id/analytics', (req, res) => {
    const { days = 7 } = req.query;
    res.json({
        success: true,
        data: {
            agentId: req.params.id,
            period: `${days} days`,
            metrics: {
                requests: 0,
                tokens: 0,
                cost: 0
            },
            charts: {
                dates: [],
                values: []
            }
        }
    });
});

// ========================================================================
// STATS & ANALYTICS
// ========================================================================

// GET /api/stats/user
app.get('/api/stats/user', (req, res) => {
    res.json({
        success: true,
        data: {
            appsCount: 1,
            totalFavorites: 0,
            totalStars: 0,
            createdLastWeek: 1,
            activityStats: {
                last7Days: 5,
                last30Days: 15
            }
        }
    });
});

// GET /api/stats/activity
app.get('/api/stats/activity', (req, res) => {
    res.json({
        success: true,
        data: [
            {
                date: new Date().toISOString().split('T')[0],
                count: 3,
                type: 'app_generated'
            },
            {
                date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
                count: 2,
                type: 'app_favorited'
            }
        ]
    });
});

// ========================================================================
// MODEL CONFIGURATION
// ========================================================================

// GET /api/model-configs
app.get('/api/model-configs', (req, res) => {
    res.json({
        success: true,
        data: [
            {
                actionKey: 'generate_app',
                provider: 'openai',
                model: 'gpt-4',
                temperature: 0.7,
                maxTokens: 4000
            },
            {
                actionKey: 'code_assistant',
                provider: 'anthropic',
                model: 'claude-3-haiku-20240307',
                temperature: 0.5,
                maxTokens: 2000
            }
        ]
    });
});

// GET /api/model-configs/:actionKey
app.get('/api/model-configs/:actionKey', (req, res) => {
    res.json({
        success: true,
        data: {
            actionKey: req.params.actionKey,
            provider: 'openai',
            model: 'gpt-4',
            temperature: 0.7,
            maxTokens: 4000
        }
    });
});

// PUT /api/model-configs/:actionKey
app.put('/api/model-configs/:actionKey', (req, res) => {
    const updates = req.body;
    res.json({
        success: true,
        data: {
            ...updates,
            updatedAt: new Date().toISOString()
        }
    });
});

// DELETE /api/model-configs/:actionKey
app.delete('/api/model-configs/:actionKey', (req, res) => {
    res.json({
        success: true,
        data: {
            actionKey: req.params.actionKey,
            deleted: true
        }
    });
});

// GET /api/model-configs/defaults
app.get('/api/model-configs/defaults', (req, res) => {
    res.json({
        success: true,
        data: [
            {
                actionKey: 'generate_app',
                provider: 'openai',
                model: 'gpt-4',
                temperature: 0.7,
                maxTokens: 4000
            }
        ]
    });
});

// POST /api/model-configs/reset-all
app.post('/api/model-configs/reset-all', (req, res) => {
    res.json({
        success: true,
        data: { message: 'All model configurations reset to defaults' }
    });
});

// GET /api/model-configs/byok-providers
app.get('/api/model-configs/byok-providers', (req, res) => {
    res.json({
        success: true,
        data: {
            providers: ['openai', 'anthropic', 'google'],
            models: {
                openai: ['gpt-4', 'gpt-3.5-turbo'],
                anthropic: ['claude-3-opus-20240229', 'claude-3-haiku-20240307']
            }
        }
    });
});

// ========================================================================
// MODEL PROVIDERS
// ========================================================================

// GET /api/user/providers
app.get('/api/user/providers', (req, res) => {
    res.json({
        success: true,
        data: []
    });
});

// POST /api/user/providers
app.post('/api/user/providers', (req, res) => {
    const provider = req.body;
    res.json({
        success: true,
        data: {
            id: 'provider-' + Math.random().toString(36).substr(2, 9),
            ...provider,
            createdAt: new Date().toISOString()
        }
    });
});

// PUT /api/user/providers/:providerId
app.put('/api/user/providers/:providerId', (req, res) => {
    const updates = req.body;
    res.json({
        success: true,
        data: {
            id: req.params.providerId,
            ...updates,
            updatedAt: new Date().toISOString()
        }
    });
});

// DELETE /api/user/providers/:providerId
app.delete('/api/user/providers/:providerId', (req, res) => {
    res.json({
        success: true,
        data: { message: 'Provider deleted successfully' }
    });
});

// POST /api/user/providers/test
app.post('/api/user/providers/test', (req, res) => {
    const { provider, config } = req.body;
    res.json({
        success: true,
        data: {
            valid: true,
            message: 'Provider configuration is valid'
        }
    });
});

// ========================================================================
// SECRETS MANAGEMENT
// ========================================================================

// GET /api/secrets
app.get('/api/secrets', (req, res) => {
    res.json({
        success: true,
        data: []
    });
});

// POST /api/secrets
app.post('/api/secrets', (req, res) => {
    const secret = req.body;
    res.json({
        success: true,
        data: {
            id: 'secret-' + Math.random().toString(36).substr(2, 9),
            ...secret,
            active: true,
            createdAt: new Date().toISOString()
        }
    });
});

// DELETE /api/secrets/:secretId
app.delete('/api/secrets/:secretId', (req, res) => {
    res.json({
        success: true,
        data: { message: 'Secret deleted successfully' }
    });
});

// PATCH /api/secrets/:secretId/toggle
app.patch('/api/secrets/:secretId/toggle', (req, res) => {
    res.json({
        success: true,
        data: {
            id: req.params.secretId,
            active: true,
            updatedAt: new Date().toISOString()
        }
    });
});

// GET /api/secrets/templates
app.get('/api/secrets/templates', (req, res) => {
    const { category } = req.query;
    res.json({
        success: true,
        data: [
            {
                id: 'openai-api-key',
                name: 'OpenAI API Key',
                envVarName: 'OPENAI_API_KEY',
                category: 'byok',
                required: true,
                description: 'Your OpenAI API key for GPT models'
            }
        ]
    });
});

// ========================================================================
// GITHUB INTEGRATION
// ========================================================================

// GET /api/github-app/authorize
app.get('/api/github-app/authorize', (req, res) => {
    res.json({
        success: true,
        data: {
            authUrl: 'https://github.com/login/oauth/authorize?client_id=mock-client-id&redirect_uri=http://localhost:3000/github/callback'
        }
    });
});

// POST /api/github-app/export
app.post('/api/github-app/export', (req, res) => {
    const { repositoryName, description } = req.body;
    res.json({
        success: true,
        data: {
            authUrl: 'https://github.com/login/oauth/authorize?client_id=mock-client-id&scope=repo&redirect_uri=http://localhost:3000/github/export/callback',
            exportId: 'export-' + Math.random().toString(36).substr(2, 9)
        }
    });
});

// ========================================================================
// ANALYTICS
// ========================================================================

// GET /api/user/:userId/analytics
app.get('/api/user/:userId/analytics', (req, res) => {
    const { days = 7 } = req.query;
    res.json({
        success: true,
        data: {
            userId: req.params.userId,
            period: `${days} days`,
            costBreakdown: {
                totalCost: 0,
                byProvider: {}
            },
            usageStats: {
                totalRequests: 0,
                totalTokens: 0
            }
        }
    });
});

        // ========================================================================
        // 404 Handler for unmatched routes
        // ========================================================================

        app.use('/api/*', (req, res) => {
            res.status(404).json({
                success: false,
                error: {
                    message: `API route ${req.originalUrl} not implemented yet`,
                    type: 'NOT_IMPLEMENTED'
                }
            });
        });

        // Start the server
        app.listen(PORT, () => {
            console.log(`🚀 Express API Server running on port ${PORT}`);
            console.log(`📡 Ready to accept requests from frontend at http://localhost:5173`);
            console.log(`📋 API Documentation: Visit /api/* endpoints`);
        });

        // Graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n👋 Shutting down Express API Server gracefully...');
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            console.log('\n👋 Shutting down Express API Server gracefully...');
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
})();
