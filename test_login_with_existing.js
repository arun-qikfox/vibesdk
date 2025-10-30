import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001';

async function testLogin() {
  try {
    console.log('🧪 Testing login with existing real user...');

    // First, let's check if there are any existing users we can test with
    console.log('Checking existing users...');

    // We'll use one of the existing real users from our cleanup output
    const testEmail = 'aruny.rajesh@gmail.com'; // This user exists with real password hash
    const testPassword = 'password123'; // Assuming this is what was used

    console.log(`🔄 Testing login for: ${testEmail}`);

    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log('✅ Login successful!');
      console.log('User data:', result.data?.user?.email);
      console.log('Access token present:', !!result.data?.accessToken);
      console.log('Session ID:', result.data?.sessionId);
    } else {
      console.log('❌ Login failed:', result.error);
      console.log('HTTP Status:', response.status);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testLogin();
