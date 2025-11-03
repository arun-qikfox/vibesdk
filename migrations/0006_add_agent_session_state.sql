-- Add state column to agent_sessions table for Strategy B
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS state JSONB;

-- Add comment to document the column
COMMENT ON COLUMN agent_sessions.state IS 'Complete agent state stored as JSON for Strategy B PostgreSQL implementation';
