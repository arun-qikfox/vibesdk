import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001';

async function testRegisterAndLogin() {
  try {
    console.log('🧪 Testing complete registration and login flow...');

    // Step 1: Register a new user
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    const testName = 'Test User';

    console.log('📝 Step 1: Registering new user...');
    console.log(`Email: ${testEmail}`);

    const registerResponse = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: testName,
      }),
    });

    const registerResult = await registerResponse.json();

    if (!registerResponse.ok || !registerResult.success) {
      console.log('❌ Registration failed:', registerResult.error || registerResult);
      return;
    }

    console.log('✅ Registration successful!');
    console.log('User ID:', registerResult.data?.user?.id);
    console.log('Access token received:', !!registerResult.data?.accessToken);

    // Step 2: Login with the same credentials
    console.log('\n🔐 Step 2: Logging in with same credentials...');

    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    const loginResult = await loginResponse.json();

    if (loginResponse.ok && loginResult.success) {
      console.log('✅ Login successful!');
      console.log('User email:', loginResult.data?.user?.email);
      console.log('Access token present:', !!loginResult.data?.accessToken);
      console.log('Session ID:', loginResult.data?.sessionId);
      console.log('\n🎉 Authentication flow working perfectly!');
    } else {
      console.log('❌ Login failed:', loginResult.error);
      console.log('HTTP Status:', loginResponse.status);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testRegisterAndLogin();
