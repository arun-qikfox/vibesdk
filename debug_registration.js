import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const client = new pg.Client(process.env.DATABASE_URL);

async function debugRegistration() {
    try {
        console.log('🔍 Testing database registration logic...');
        await client.connect();
        console.log('✅ Connected to database');

        // Test 1: Check if users table exists and has expected columns
        console.log('\n📋 Checking users table schema...');
        const columnsResult = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'users'
            ORDER BY ordinal_position
        `);
        console.log('Users table columns:');
        columnsResult.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type}, ${col.is_nullable})`);
        });

        // Test 2: Try the existing user check query
        console.log('\n🔍 Testing user existence check...');
        const email = 'test@example.com';
        const checkQuery = `
            SELECT "id", "email", "password_hash"
            FROM "users"
            WHERE "users"."email" = $1
            LIMIT 1
        `;
        console.log(`Query: ${checkQuery}`);
        console.log(`Params: [${email}]`);

        const result = await client.query(checkQuery, [email]);
        console.log('✅ Query executed successfully');
        console.log(`Result: ${result.rows.length} rows found`);

        if (result.rows.length > 0) {
            console.log('Existing user found:', result.rows[0]);
        } else {
            console.log('✅ No existing user found - good for registration');
        }

        // Test 3: Try user insertion (mock data)
        console.log('\n💾 Testing user insertion...');
        const userId = 'test-user-' + Date.now();
        const insertQuery = `
            INSERT INTO "users" (
                "id", "email", "display_name", "password_hash",
                "provider", "provider_id", "email_verified",
                "created_at", "updated_at"
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9
            )
        `;
        const insertParams = [
            userId,
            email,
            'Test User',
            'hashed_password_mock',
            'email',
            userId,
            true,
            new Date(),
            new Date()
        ];

        console.log(`Insert query: ${insertQuery.replace(/\s+/g, ' ').trim()}`);
        console.log(`Insert params: [${insertParams.map(p => typeof p === 'string' ? `"${p}"` : p).join(', ')}]`);

        await client.query(insertQuery, insertParams);
        console.log('✅ User inserted successfully');

        // Test 4: Verify user was created
        console.log('\n🔍 Verifying user creation...');
        const verifyResult = await client.query(checkQuery, [email]);
        console.log(`User found after creation: ${verifyResult.rows.length > 0 ? '✅ YES' : '❌ NO'}`);
        if (verifyResult.rows.length > 0) {
            console.log('Created user:', verifyResult.rows[0]);
        }

        console.log('\n🎉 Database operations work correctly!');

    } catch (error) {
        console.error('❌ Database error:', error.message);
        if (error.code) {
            console.error('Error code:', error.code);
        }
        if (error.detail) {
            console.error('Error detail:', error.detail);
        }
    } finally {
        await client.end();
    }
}

debugRegistration();
