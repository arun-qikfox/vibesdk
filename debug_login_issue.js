import postgres from 'postgres';
import { config } from 'dotenv';
config();

// Debug script to investigate login issue
async function debugLoginIssue() {
  let sql;

  try {
    console.log('🔍 Debugging login issue...');

    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not set');
    }

    sql = postgres(process.env.DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });

    // First, let's see what the user registration created
    console.log('\n📊 Checking users table structure and data...');

    // Check table structure
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `;

    console.log('Users table columns:');
    columns.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
    });

    // Check all users
    const users = await sql`SELECT id, email, password_hash, provider, created_at FROM users LIMIT 5`;
    console.log('\n👥 Found users:');
    users.forEach(user => {
      console.log(`  ID: ${user.id}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Provider: ${user.provider}`);
      console.log(`  Has Password Hash: ${!!user.password_hash}`);
      if (user.password_hash) {
        console.log(`  Password Hash Length: ${user.password_hash.length}`);
        console.log(`  Password Hash Prefix: ${user.password_hash.substring(0, 20)}...`);
      }
      console.log(`  Created: ${user.created_at}`);
      console.log('  ---');
    });

    // Test password verification logic
    if (users.length > 0 && users[0].password_hash) {
      const passwordHashFromDB = users[0].password_hash;
      const testPassword = 'password123'; // Assuming this was the test password

      console.log('\n🔐 Testing password verification...');

      // Import the same password service used in AuthService
      const { PasswordService } = await import('./worker/utils/passwordService.ts');
      const passwordService = new PasswordService();

      try {
        // Hash the test password
        const hashedTestPassword = await passwordService.hash(testPassword);
        console.log(`  Test password hash length: ${hashedTestPassword.length}`);
        console.log(`  Test password hash prefix: ${hashedTestPassword.substring(0, 20)}...`);

        // Test verification with itself (should pass)
        const verifySelf = await passwordService.verify(testPassword, hashedTestPassword);
        console.log(`  Self-verification (should pass): ${verifySelf}`);

        // Test verification with DB hash
        const verifyDB = await passwordService.verify(testPassword, passwordHashFromDB);
        console.log(`  DB hash verification: ${verifyDB}`);

        console.log('\n📋 Hash comparison:');
        console.log(`  DB hash:    ${passwordHashFromDB}`);
        console.log(`  Test hash:  ${hashedTestPassword}`);
        console.log(`  Match: ${passwordHashFromDB === hashedTestPassword}`);

      } catch (hashError) {
        console.error('❌ Password verification test failed:', hashError);
      }
    } else {
      console.log('\n⚠️  No users with password hashes found');
    }

    // Check auth attempts
    console.log('\n📋 Recent auth attempts:');
    const attempts = await sql`
      SELECT identifier, attempt_type, success, attempted_at
      FROM auth_attempts
      ORDER BY attempted_at DESC
      LIMIT 5
    `;

    attempts.forEach(attempt => {
      console.log(`  ${attempt.identifier}: ${attempt.attempt_type} - ${attempt.success} (${attempt.attempted_at})`);
    });

  } catch (error) {
    console.error('❌ Debug script failed:', error);
    console.error(error.stack);
  } finally {
    if (sql) await sql.end();
  }
}

debugLoginIssue();
