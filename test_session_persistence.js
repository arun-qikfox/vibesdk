#!/usr/bin/env node

/**
 * Test script for session persistence across requests
 * Simulates: Register → Login → Profile Request (page load)
 */

import fetch from 'node-fetch';
import { URLSearchParams } from 'url';

// Simple API client for testing
async function apiRequest(endpoint, options = {}) {
    const baseURL = 'http://localhost:3001';
    const url = new URL(endpoint, baseURL);

    // Default headers
    const defaultHeaders = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    // Handle cookies from previous responses
    let headers = defaultHeaders;
    if (global.cookieJar) {
        headers = {
            ...headers,
            'Cookie': global.cookieJar
        };
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    // Store cookies from response
    const setCookies = response.headers.raw()['set-cookie'];
    if (setCookies) {
        console.log('🔍 Response cookies:', setCookies);
        global.cookieJar = Array.isArray(setCookies) ? setCookies.join('; ') : setCookies;
    }

    return response;
}

async function testSessionPersistence() {
    console.log('🧪 Testing JWT token flow for Hono backend...\n');

    try {
        // Step 1: Register new user
        console.log('📝 Step 1: Registering new user...');
        const testEmail = `test-${Date.now()}@example.com`;
        const testPassword = 'TestPassword123!';

        const registerResponse = await apiRequest('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmail,
                password: testPassword,
                name: 'Test User'
            }),
        });

        const registerText = await registerResponse.text();
        const registerData = JSON.parse(registerText);
        if (!registerData.success) {
            console.log('❌ Registration failed:', registerData.error);
            return;
        }

        console.log('✅ Registration successful!');
        console.log(`   User ID: ${registerData.data.user.id}`);
        console.log(`   Email: ${registerData.data.user.email}`);
        console.log(`   Session ID: ${registerData.data.sessionId}\n`);

        // Step 2: Login (get fresh cookies)
        console.log('🔐 Step 2: Logging in...');

        // Note: The API client will automatically handle cookies from the registration
        // response, so this simulates keeping the same session
        const loginResponse = await apiRequest('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmail,
                password: testPassword
            }),
        });

        const loginText = await loginResponse.text();
        const loginData = JSON.parse(loginText);
        if (!loginData.success) {
            console.log('❌ Login failed:', loginData.error);
            return;
        }

        console.log('✅ Login successful!');
        console.log(`   User ID: ${loginData.data.user.id}`);
        console.log(`   Email: ${loginData.data.user.email}`);
        console.log(`   Session ID: ${loginData.data.sessionId}\n`);

        // Step 3: Make profile request (simulating page load)
        console.log('🔄 Step 3: Simulating page reload - requesting profile...');

        // Important: Don't pass additional headers to test cookie-based auth
        const profileResponse = await apiRequest('/api/auth/profile', {
            method: 'GET',
        });

        const profileText = await profileResponse.text();
        const profileData = JSON.parse(profileText);
        if (!profileData.success) {
            console.log('❌ Profile request failed:', profileData.error);
            console.log('   This indicates session persistence is NOT working!');
            return;
        }

        // Step 4: Verify profile data matches
        console.log('✅ Profile request successful!');
        console.log(`   User ID: ${profileData.data.id}`);
        console.log(`   Email: ${profileData.data.email}`);
        console.log(`   Display Name: ${profileData.data.displayName}\n`);

        // Step 5: Validate the data
        if (profileData.data.id === loginData.data.user.id &&
            profileData.data.email === loginData.data.user.email) {
            console.log('🎉 SUCCESS: Session persistence works perfectly!');
            console.log('   User remains authenticated across requests');
            console.log('   Authentication state survives page reloads');
        } else {
            console.log('⚠️  WARNING: Profile data doesn\'t match login data');
            console.log('   - Login user ID:', loginData.data.user.id);
            console.log('   - Profile user ID:', profileData.data.id);
        }

    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testSessionPersistence().then(() => {
    console.log('\n🏁 Session persistence test completed');
    process.exit(0);
}).catch((error) => {
    console.error('\n💥 Test failed completely:', error);
    process.exit(1);
});
