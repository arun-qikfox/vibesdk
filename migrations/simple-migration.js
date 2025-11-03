// Simple migration to create essential tables for Strategy B
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function runMigrations() {
  const client = new pg.Client(process.env.DATABASE_URL);

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    // Create agent_sessions table
    await client.query(`CREATE TABLE IF NOT EXISTS agent_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      app_id TEXT,
      status VARCHAR(50) DEFAULT 'initialized',
      blueprint JSONB,
      phases JSONB DEFAULT '{}'::jsonb,
      execution_data JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('✅ Created agent_sessions table');

    // Create agent_phases table
    await client.query(`CREATE TABLE IF NOT EXISTS agent_phases (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES agent_sessions(id) ON DELETE CASCADE,
      phase_name VARCHAR(100),
      phase_type VARCHAR(50),
      phase_key VARCHAR(50),
      status VARCHAR(50) DEFAULT 'pending',
      priority INTEGER DEFAULT 1,
      config JSONB DEFAULT '{}'::jsonb,
      input_data JSONB,
      result JSONB,
      output_files JSONB DEFAULT '[]'::jsonb,
      error_message TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('✅ Created agent_phases table');

    console.log('🎉 Essential tables created successfully');
  } catch (error) {
    console.error('Migration failed:', error.message);
  } finally {
    await client.end();
  }
}

runMigrations();
