
const postgres = require('postgres');
require('dotenv').config({ path: '../.env' });

async function runMigrations() {
  try {
    console.log('🚀 Starting migration...');

    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    const sql = postgres(process.env.DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });

    console.log('📦 Running SQL migrations from migrations/gcp...');

    // Read migration files and execute them in order
    const fs = require('fs');
    const path = require('path');

    const migrationDir = path.join(__dirname, '..', 'migrations', 'gcp');
    const files = fs.readdirSync(migrationDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const filePath = path.join(migrationDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf8');

      console.log(`📄 Executing migration: ${file}`);
      await sql.unsafe(sqlContent);
      console.log(`✅ Applied: ${file}`);
    }

    // Additional migration to fix auth_attempts ip_address column
    console.log('🔧 Applying additional migration: Fix auth_attempts.ip_address to allow NULL');
    await sql`
      ALTER TABLE auth_attempts
      ALTER COLUMN ip_address DROP NOT NULL;
    `;
    console.log('✅ Fixed auth_attempts.ip_address to allow NULL values');

    await sql.end();
    console.log('🎉 Successfully applied all GCP migrations!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

runMigrations();
