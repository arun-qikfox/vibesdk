const postgres = require('postgres');
require('dotenv').config({ path: '../.env' });

async function createTables() {
  try {
    console.log('🚀 Starting table creation...');

    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    const sql = postgres({
  host: '127.0.0.1',
  port: 5432,
  database: 'vibesdk',
  username: 'vibesdk-user',
  password: 'vibesdk123',  // no encoding needed here
  ssl: false,
});

    console.log('📦 Creating core authentication tables...');

    // Create users table
    await sql`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      username TEXT UNIQUE,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      bio TEXT,
      provider TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      email_verified BOOLEAN DEFAULT FALSE,
      password_hash TEXT,
      failed_login_attempts INTEGER DEFAULT 0,
      locked_until TIMESTAMP WITH TIME ZONE,
      password_changed_at TIMESTAMP WITH TIME ZONE,
      preferences JSONB DEFAULT '{}'::jsonb,
      theme TEXT DEFAULT 'system',
      timezone TEXT DEFAULT 'UTC',
      is_active BOOLEAN DEFAULT TRUE,
      is_suspended BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      last_active_at TIMESTAMP WITH TIME ZONE,
      deleted_at TIMESTAMP WITH TIME ZONE
    )`;
    console.log('✅ Created users table');

    // Create auth_attempts table
    await sql`CREATE TABLE IF NOT EXISTS auth_attempts (
      id SERIAL PRIMARY KEY,
      identifier TEXT NOT NULL,
      attempt_type TEXT NOT NULL,
      success BOOLEAN NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      attempted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`;
    console.log('✅ Created auth_attempts table');

    // Create sessions table
    await sql`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_info TEXT,
      user_agent TEXT,
      ip_address TEXT,
      is_revoked BOOLEAN DEFAULT FALSE,
      revoked_at TIMESTAMP WITH TIME ZONE,
      revoked_reason TEXT,
      access_token_hash TEXT NOT NULL,
      refresh_token_hash TEXT NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      last_activity TIMESTAMP WITH TIME ZONE
    )`;
    console.log('✅ Created sessions table');

    // Create indexes
    await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email)`;
    await sql`CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_users_provider ON users(provider, provider_id)`;
    await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user ON sessions(user_id)`;
    await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_token ON sessions(access_token_hash)`;
    await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auth_attempts_identifier ON auth_attempts(identifier, attempted_at)`;
    console.log('✅ Created indexes');

    // Fix auth_attempts table to allow NULL ip_address
    console.log('🔧 Fixing auth_attempts.ip_address to allow NULL values...');
    await sql`ALTER TABLE auth_attempts ALTER COLUMN ip_address DROP NOT NULL`;
    console.log('✅ Fixed ip_address column to be nullable');

    await sql.end();
    console.log('✅ Successfully created core authentication tables!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

createTables();
