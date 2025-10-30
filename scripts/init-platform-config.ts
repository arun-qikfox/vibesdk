#!/usr/bin/env tsx

/**
 * Initialize default platform configuration in GCS KV store
 * This script creates the default platform_configs entry that the application expects
 */

import { Storage } from '@google-cloud/storage';
import { getAccessToken } from '../shared/platform/gcp/auth';

interface ConfigurableSecuritySettings {
    rateLimit: {
        apiRateLimit: {
            enabled: boolean;
            store: string;
            bindingName: string;
        };
        authRateLimit: {
            enabled: boolean;
            store: string;
            bindingName: string;
        };
        appCreation: {
            enabled: boolean;
            store: string;
            limit: number;
            dailyLimit: number;
            period: number;
        };
        llmCalls: {
            enabled: boolean;
            store: string;
            limit: number;
            period: number;
            dailyLimit: number;
            excludeBYOKUsers: boolean;
        };
    };
}

interface GlobalConfigurableSettings {
    security: ConfigurableSecuritySettings;
    globalMessaging: {
        globalUserMessage: string;
        changeLogs: string;
    };
}

async function initializePlatformConfig() {
    console.log('Initializing platform configuration in GCS KV store...');
    
    // Get GCP access token from environment or metadata server
    const accessToken = process.env.GCP_ACCESS_TOKEN || await getAccessToken();
    console.log('GCP access token obtained');
    
    // Initialize GCS client
    const storage = new Storage({
        projectId: 'qfxcloud-app-builder',
        // Use the access token directly
        keyFilename: undefined,
        credentials: undefined,
    });
    
    // Set the access token for authentication
    if (accessToken) {
        // Override the default authentication to use the access token
        const { GoogleAuth } = await import('google-auth-library');
        const auth = new GoogleAuth({
            projectId: 'qfxcloud-app-builder',
        });
        
        // Create a custom client with the access token
        const authClient = {
            getAccessToken: async () => ({ token: accessToken }),
            getRequestHeaders: async () => ({ Authorization: `Bearer ${accessToken}` }),
        };
        
        // Override the auth client
        (storage as any).authClient = authClient;
    }
    
    const bucketName = 'vibesdk-frontend';
    const bucket = storage.bucket(bucketName);
    
    // Create default platform configuration
    const defaultConfig: GlobalConfigurableSettings = {
        security: {
            rateLimit: {
                apiRateLimit: {
                    enabled: false, // Disabled for GCP deployment
                    store: 'RATE_LIMITER',
                    bindingName: 'API_RATE_LIMITER',
                },
                authRateLimit: {
                    enabled: false, // Disabled for GCP deployment
                    store: 'RATE_LIMITER',
                    bindingName: 'AUTH_RATE_LIMITER',
                },
                appCreation: {
                    enabled: true, // Keep enabled
                    store: 'DURABLE_OBJECT',
                    limit: 10,
                    dailyLimit: 50,
                    period: 3600, // 1 hour
                },
                llmCalls: {
                    enabled: true, // Keep enabled
                    store: 'DURABLE_OBJECT',
                    limit: 100,
                    period: 3600, // 1 hour
                    dailyLimit: 400,
                    excludeBYOKUsers: true,
                },
            },
        },
        globalMessaging: {
            globalUserMessage: '',
            changeLogs: '',
        },
    };
    
    // Convert to JSON string
    const configJson = JSON.stringify(defaultConfig, null, 2);
    console.log('Default configuration created:', configJson);
    
    // Upload to GCS KV store
    const objectKey = 'kv/platform_configs';
    const file = bucket.file(objectKey);
    
    try {
        await file.save(configJson, {
            metadata: {
                contentType: 'application/json',
                cacheControl: 'no-cache',
            },
        });
        
        console.log(`✅ Successfully uploaded platform configuration to gs://${bucketName}/${objectKey}`);
        
        // Verify the upload
        const [exists] = await file.exists();
        if (exists) {
            console.log('✅ Verification: Configuration file exists in GCS');
            
            // Test reading the configuration
            const [content] = await file.download();
            const downloadedConfig = JSON.parse(content.toString('utf8'));
            console.log('✅ Verification: Configuration can be read from GCS');
            console.log('Downloaded config:', JSON.stringify(downloadedConfig, null, 2));
        } else {
            console.error('❌ Verification failed: Configuration file does not exist');
        }
        
    } catch (error) {
        console.error('❌ Failed to upload platform configuration:', error);
        throw error;
    }
}

// Run the initialization
initializePlatformConfig()
    .then(() => {
        console.log('🎉 Platform configuration initialization completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Platform configuration initialization failed:', error);
        process.exit(1);
    });

export { initializePlatformConfig };
