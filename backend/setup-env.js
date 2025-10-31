// Load environment bridge (provides Worker-compatible global.env)
require('./worker-env-bridge');

const path = require('path');

// Import service adapter (loads actual Worker TypeScript services)
const { initializeWorkerServices, loadWorkerServices } = require('./worker-service-adapter');

// Make services available globally as Cloudflare Worker expects
async function setupGlobalEnvironment() {
  // First, load the actual Worker TypeScript services
  console.log('⏳ Loading TypeScript services...');
  await loadWorkerServices();
  console.log('✅ TypeScript services loaded');
    try {
        console.log('🔗 Loading environment bridge (polyfills + env mapping)...');

        // Load infrastructure services (Postgres, GCS, Firestore) using shared platform
        let postgresClient, gcsClient, firestoreClient;

        try {
            console.log('🔄 Setting up PostgreSQL client...')

            // Import the factory to create the proper database client
            const { createDatabaseClient } = await import('../worker/database/runtime/factory.ts');

            console.log('🔄 Creating database client...')
            postgresClient = createDatabaseClient(global.env);
            console.log('✅ Postgres client created:', typeof postgresClient, postgresClient?.constructor?.name || 'unknown');
        } catch (e) {
            console.warn('Postgres client failed, using mock:', e.message);
            console.warn('Stack trace:', e.stack);
            postgresClient = createMockDatabaseClient();
        }

        try {
            const storageModule = await import('../shared/platform/storage/gcpObjectStore.js');
            if (storageModule.createGcpObjectStore && process.env.GCP_PROJECT_ID) {
                gcsClient = storageModule.createGcpObjectStore(process.env.GCP_PROJECT_ID);
                console.log('✅ GCS storage client loaded');
            } else {
                gcsClient = createMockStorageClient();
                console.log('⚠️  Using mock storage client');
            }
        } catch (e) {
            console.warn('GCS client failed, using mock:', e.message);
            gcsClient = createMockStorageClient();
        }

        try {
            const kvModule = await import('../shared/platform/kv/gcpFirestoreProvider.js');
            if (kvModule.createGcpFirestoreProvider && process.env.GCP_PROJECT_ID) {
                firestoreClient = kvModule.createGcpFirestoreProvider({
                    projectId: process.env.GCP_PROJECT_ID,
                    collectionName: process.env.FIRESTORE_COLLECTION || 'user-data'
                });
                console.log('✅ Firestore KV client loaded');
            } else {
                firestoreClient = createMockKVClient();
                console.log('⚠️  Using mock KV client');
            }
        } catch (e) {
            console.warn('Firestore client failed, using mock:', e.message);
            firestoreClient = createMockKVClient();
        }

        // Set up infrastructure services in global.env
        global.env.DB = postgresClient;
        global.env.STORAGE = gcsClient;
        global.env.KV = firestoreClient;

        console.log('🔄 DATABASE_URL in process.env:', process.env.DATABASE_URL ? 'set' : 'not set');
        console.log('🔄 DATABASE_URL in global.env:', global.env.DATABASE_URL ? 'set' : 'not set');

        // Initialize Worker TypeScript services (AuthService, UserService, etc.)
        console.log('🏗️  Initializing Worker TypeScript services...');
        console.log(`DB client: ${typeof global.env.DB}, DB constructor: ${global.env.DB?.constructor?.name || 'undefined'}`);
        console.log(`RUNTIME_PROVIDER in global.env: ${global.env.RUNTIME_PROVIDER}`);

        const workerServices = await initializeWorkerServices(global.env);
        global.env.__services__ = workerServices;

        // Cache the AuthService instance globally for middleware access
        if (workerServices.authService) {
            global.cachedAuthService = workerServices.authService;
            console.log('✅ AuthService cached globally for middleware');
        } else {
            console.warn('⚠️  No AuthService instance available to cache globally');
        }

        console.log('✅ Environment and services setup complete');
        console.log(`📍 Runtime: ${global.env.RUNTIME_PROVIDER}`);
        console.log(`🗄️  Database: ${global.env.DATABASE_URL ? 'Connected' : 'Mock'}`);
        console.log(`📦 Storage: ${global.env.GCS_TEMPLATES_BUCKET ? 'GCS' : 'Mock'}`);
        console.log(`🔥 KV Store: ${global.env.FIRESTORE_COLLECTION ? 'Firestore' : 'Mock'}`);
        console.log(`🔐 Auth Service: ${workerServices.authService?.constructor?.name || 'Not Available'}`);

        return true;

    } catch (error) {
        console.error('❌ Failed to setup global environment:', error);
        throw error;
    }
}

// Mock implementations for development/testing when GCP services aren't available
function createMockDatabaseClient() {
    return {
        prepare: (query) => ({
            bind: (...args) => ({

                run: async () => ({ success: true }),
                all: async () => [],
                first: async () => null
            })
        })
    };
}

function createMockStorageClient() {
    return {
        get: async (key) => null,
        put: async (key, value) => ({ success: true }),
        delete: async (key) => ({ success: true }),
        list: async (options = {}) => ({ keys: [], cursor: null })
    };
}

function createMockKVClient() {
    const store = new Map();
    return {
        get: async (key) => store.get(key) || null,
        put: async (key, value) => store.set(key, value),
        delete: async (key) => store.delete(key),
        list: async () => ({ keys: Array.from(store.keys()).map(k => ({ name: k })) })
    };
}

module.exports = { setupGlobalEnvironment };
