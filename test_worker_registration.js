import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Mock the worker environment
const mockEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET || 'test-secret',
    RUNTIME_PROVIDER: 'gcp',
    GCS_FRONTEND_BUCKET: 'test-bucket',
    CLOUDFLARE_ACCOUNT_ID: 'test',
    CLOUDFLARE_API_TOKEN: 'test',
};

// Import and test the workers
async function testWorkerRegistration() {
    try {
        console.log('🧪 Testing Worker Registration Flow...\n');

        // Add the shared directory to the path for imports
        const sharedPath = 'shared';
        if (!process.env.NODE_PATH?.includes(sharedPath)) {
            process.env.NODE_PATH = [process.env.NODE_PATH, sharedPath].filter(Boolean).join(':');
        }

        // Dynamic import with error handling
        console.log('Loading worker modules...');
        const { AuthService } = await import('./worker/database/services/AuthService.ts');

        console.log('✅ Worker modules loaded');

        // Create AuthService instance
        const authService = new AuthService(mockEnv);
        console.log('✅ AuthService created');

        // Create a mock request
        const mockRequest = new Request('http://test.com/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Node.js Test',
                'CF-Connecting-IP': '127.0.0.1'
            }
        });

        console.log('🧪 Testing registration...');
        const result = await authService.register({
            email: 'worker-test@example.com',
            password: 'TestPassword123!',
            name: 'Worker Test'
        }, mockRequest);

        console.log('✅ SUCCESS: Registration completed!');
        console.log('Result:', {
            userId: result.user?.id,
            email: result.user?.email,
            displayName: result.user?.displayName,
            sessionId: result.sessionId,
            hasAccessToken: !!result.accessToken
        });

        return result;

    } catch (error) {
        console.error('❌ Registration failed:', error.message);
        console.error('Error details:', error);

        // If it has a cause, show that too
        if (error.cause) {
            console.error('Error cause:', error.cause);
        }

        throw error;
    }
}

// Run the test
testWorkerRegistration().then(() => {
    console.log('\n🎉 Worker registration test passed!');
}).catch(err => {
    console.error('\n💥 Worker registration test failed:', err.message);
    process.exit(1);
});
