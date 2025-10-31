#!/usr/bin/env node

/**
 * Simple session persistence test using raw HTTP requests
 */

const http = require('http');
const https = require('https');

async function makeRequest(path, options = {}) {
    return new Promise((resolve, reject) => {
        const reqOptions = {
            hostname: 'localhost',
            port: 3001,
            path: path,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        // Use http for localhost
        const req = http.request(reqOptions, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const parsed = data ? JSON.parse(data) : null;
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: parsed,
                        raw: data,
                        setCookie: res.headers['set-cookie']
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: null,
                        raw: data,
                        setCookie: res.headers['set-cookie']
                    });
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        if (options.body) {
            req.write(JSON.stringify(options.body));
        }

        req.end();
    });
}

async function testSessionPersistence() {
    console.log('🧪 Testing session persistence...\n');

    try {
        // Define a helper to collect cookies from responses
        let cookies = [];

        function collectCookies(response) {
            if (response.setCookie) {
                cookies.push(...response.setCookie);
            }
        }

        function buildCookieHeader() {
            return cookies.map(cookie => cookie.split(';')[0]).join('; ');
        }

        // Step 1: Register new user
        console.log('📝 Step 1: Registering new user...');
        const testEmail = `test-session-${Date.now()}@example.com`;
        const testPassword = 'TestPassword123!';

        const registerRes = await makeRequest('/api/auth/register', {
            method: 'POST',
            body: {
                email: testEmail,
                password: testPassword,
                name: 'Test User'
            }
        });

        collectCookies(registerRes);

        if (!registerRes.data?.success) {
            console.log('❌ Registration failed:', registerRes.data?.error);
            return;
        }

        console.log('✅ Registration successful!');
        console.log(`   User ID: ${registerRes.data.data.user.id}`);
        console.log(`   Email: ${registerRes.data.data.user.email}`);
        console.log(`   Session cookies collected: ${cookies.length}\n`);

        // Step 2: Make a profile request (simulating page load)
        console.log('🔄 Step 2: Simulating page reload - requesting profile...');
        console.log(`   Using cookies: ${buildCookieHeader()}`);

        const profileRes = await makeRequest('/api/auth/profile', {
            method: 'GET',
            headers: {
                'Cookie': buildCookieHeader()
            }
        });

        if (!profileRes.data?.success) {
            console.log('❌ Profile request failed:', profileRes.data?.error);
            console.log('   Status:', profileRes.status);
            console.log('   This indicates session persistence is NOT working!');
            console.log('   Full response:', profileRes);
            return;
        }

        // Step 3: Verify profile data
        console.log('✅ Profile request successful!');
        console.log(`   User ID: ${profileRes.data.data.id}`);
        console.log(`   Email: ${profileRes.data.data.email}`);
        console.log(`   Display Name: ${profileRes.data.data.displayName}\n`);

        // Step 4: Validate the data matches
        if (profileRes.data.data.id === registerRes.data.data.user.id &&
            profileRes.data.data.email === registerRes.data.data.user.email) {
            console.log('🎉 SUCCESS: Session persistence works perfectly!');
            console.log('   User remains authenticated across requests');
            console.log('   Cookies and authentication middleware are working');
        } else {
            console.log('⚠️  WARNING: Profile data doesn\'t match registration data');
            console.log('   - Registration user ID:', registerRes.data.data.user.id);
            console.log('   - Profile user ID:', profileRes.data.data.id);
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
