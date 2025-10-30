import postgres from 'postgres';
import { config } from 'dotenv';
config();

async function cleanupMockPasswords() {
  let sql;

  try {
    console.log('🧹 Cleaning up mock password hashes...');

    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not set');
    }

    sql = postgres(process.env.DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });

    console.log('\n🔍 Finding users with mock password hashes...');

    // Find users with mock password hashes
    const mockUsers = await sql`
      SELECT id, email, password_hash
      FROM users
      WHERE password_hash = 'hashed_password_mock'
    `;

    console.log(`Found ${mockUsers.length} users with mock passwords:`);
    mockUsers.forEach(user => {
      console.log(`  - ${user.email} (ID: ${user.id})`);
    });

    if (mockUsers.length === 0) {
      console.log('✅ No mock password hashes found!');
      return;
    }

    console.log('\n🗑️  Deleting users with mock password hashes...');

    // Delete these users since they're test data
    const deleteResult = await sql`
      DELETE FROM users
      WHERE password_hash = 'hashed_password_mock'
    `;

    console.log(`✅ Deleted ${deleteResult.count} users with mock passwords`);

    console.log('\n📊 Current state after cleanup:');

    // Show remaining users
    const realUsers = await sql`
      SELECT id, email, length(password_hash) as hash_length
      FROM users
      WHERE password_hash IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 5
    `;

    console.log(`Remaining users with real passwords: ${realUsers.length}`);
    realUsers.forEach(user => {
      console.log(`  - ${user.email}: hash length ${user.hash_length}`);
    });

    console.log('\n🎉 Password hash cleanup completed!');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    console.error(error.stack);
  } finally {
    if (sql) await sql.end();
  }
}

cleanupMockPasswords();
