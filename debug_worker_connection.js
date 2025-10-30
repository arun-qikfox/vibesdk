import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Try to get database URL using the same logic as the worker
function getDatabaseUrl() {
    // This mimics how the worker gets the configuration
    const databaseUrl = process.env.DATABASE_URL;
    console.log('📋 Environment DATABASE_URL:', databaseUrl?.substring(0, 50) + '...');

    if (!databaseUrl) {
        console.error('❌ No DATABASE_URL found in environment');
        return null;
    }

    return databaseUrl;
}

async function debugWorkerConnection() {
    try {
        console.log('🔍 Testing Worker-Style Database Connection...\n');

        const databaseUrl = getDatabaseUrl();
        if (!databaseUrl) {
            console.error('❌ Cannot test without DATABASE_URL');
            return;
        }

        console.log('✅ Found DATABASE_URL');
        const client = new pg.Client(databaseUrl);

        console.log('🔗 Connecting to database...');
        await client.connect();
        console.log('✅ Connected successfully');

        console.log('📋 Testing exact queries that fail in worker...');

        // Test 1: The exact auth_attempts insert that fails
        try {
            console.log('\n1. Testing auth_attempts insert...');
            const insertQuery = `insert into "auth_attempts" ("id", "identifier", "attempt_type", "success", "ip_address", "user_agent", "attempted_at") values (default, $1, $2, $3, $4, $5, default)`;
            const params = ['user@example1.com', 'register', false, 'unknown', 'PostmanRuntime/7.49.0'];

            console.log(`Query: ${insertQuery}`);
            console.log(`Params: [${params.join(', ')}]`);

            await client.query(insertQuery, params);
            console.log('✅ auth_attempts insert succeeded');
        } catch (error) {
            console.error('❌ auth_attempts insert failed:', error.message);
            console.error('Error code:', error.code);
            console.error('Error details:', error.detail);
        }

        // Test 2: The exact users select that fails
        try {
            console.log('\n2. Testing users select...');
            const selectQuery = `select "id", "email", "password_hash" from "users" where "users"."email" = $1 limit $2`;
            const params = ['user@example1.com', 1];

            console.log(`Query: ${selectQuery}`);
            console.log(`Params: [${params.join(', ')}]`);

            const result = await client.query(selectQuery, params);
            console.log('✅ users select succeeded, found:', result.rows.length, 'rows');
        } catch (error) {
            console.error('❌ users select failed:', error.message);
            console.error('Error code:', error.code);
            console.error('Error details:', error.detail);
        }

        // Test 3: Basic connection test
        try {
            console.log('\n3. Testing basic connection...');
            const result = await client.query('SELECT NOW()');
            console.log('✅ Basic query succeeded:', result.rows[0]);
        } catch (error) {
            console.error('❌ Basic query failed:', error.message);
        }

        // Test 4: Check user count
        try {
            console.log('\n4. Checking user table...');
            const result = await client.query('SELECT COUNT(*) as user_count FROM users');
            console.log('✅ User count query succeeded:', result.rows[0]);
        } catch (error) {
            console.error('❌ User count query failed:', error.message);
        }

    } catch (error) {
        console.error('❌ Connection failed completely:', error.message);
        if (error.code) {
            console.error('Error code:', error.code);
        }
    }
}

debugWorkerConnection();
