// Migration to add state column to agent_sessions table
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function runStateMigration() {
  const client = new pg.Client(process.env.DATABASE_URL);

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    // Add state column to agent_sessions table
    await client.query(`
      ALTER TABLE agent_sessions
      ADD COLUMN IF NOT EXISTS state JSONB;
    `);

    // Add comment to document the column
    await client.query(`
      COMMENT ON COLUMN agent_sessions.state IS 'Complete agent state stored as JSON for Strategy B PostgreSQL implementation';
    `);

    console.log('✅ Added state column to agent_sessions table');
    console.log('🎉 State migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error.message);
  } finally {
    await client.end();
  }
}

runStateMigration();
