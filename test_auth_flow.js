/**
 * Unit test for authentication flow consistency
 * Tests that signup → profile works correctly
 */

import nodeFetch from 'node-fetch';
const fetch = nodeFetch;
const baseUrl = 'http://localhost:3001';

async function testAuthFlow() {
    console.log('🧪 Testing Authentication Flow...\n');

    try {
        // Test 1: Initial profile check (should return 401)
        console.log('1. Testing initial profile check (unauthenticated)...');
        const profile1 = await fetch(`${baseUrl}/api/auth/profile`, {
            method: 'GET',
            credentials: 'include'
        });

        if (profile1.status === 401) {
            console.log('✅ Initial profile returns 401 as expected');
        } else {
            console.log('❌ Initial profile should return 401, got:', profile1.status);
        }

        // Test 2: Register a new user
        console.log('\n2. Testing user registration...');
        const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'test@example.com',
                password: 'Password123!',
                name: 'Test User'
            })
        });

        const registerData = await registerResponse.json();
        console.log('Register response:', registerData);

        if (registerData.success && registerData.data?.user) {
            console.log('✅ Registration successful:', registerData.data.user.email);

            // Extract session cookie from response
            const setCookieHeader = registerResponse.headers.get('set-cookie');
            console.log('Session cookie created:', setCookieHeader?.includes('session='));

            // Test 3: Profile check with JWT token in Authorization header
            console.log('\n3. Testing profile with JWT token...');
            const accessToken = registerData.data.accessToken;
            const profile2 = await fetch(`${baseUrl}/api/auth/profile`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            const profileData2 = await profile2.json();
            console.log('Profile response:', profileData2);

            if (profileData2.success && profileData2.data?.user) {
                console.log('✅ Profile returns user data:', profileData2.data.user.email);

                // Test 4: Check consistency of user data
                console.log('\n4. Testing user data consistency...');
                const registeredEmail = registerData.data.user.email;
                const profileEmail = profileData2.data.user.email;
                const registeredName = registerData.data.user.displayName;
                const profileName = profileData2.data.user.displayName;

                console.log('Registered user:', { email: registeredEmail, name: registeredName });
                console.log('Profile user:', { email: profileEmail, name: profileName });

                if (registeredEmail === profileEmail && registeredName === profileName) {
                    console.log('✅ User data is consistent');
                } else {
                    console.log('❌ User data is inconsistent!');
                }

            } else {
                console.log('❌ Profile should return user data');
            }

        } else {
            console.log('❌ Registration failed:', registerData);
        }

    } catch (error) {
        console.error('Test failed:', error.message);
    }

    console.log('\n🧪 Authentication flow test complete\n');
}

// Run the test
testAuthFlow().catch(console.error);
