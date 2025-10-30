-- 0001_cloud_run_deployments.sql
-- Adds app_deployments table for Cloud Run deployment tracking.

CREATE TABLE IF NOT EXISTS app_deployments (
    id SERIAL PRIMARY KEY,
    app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    target TEXT NOT NULL,
    service_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS app_deployments_app_target_version_idx
    ON app_deployments (app_id, target, version);
CREATE INDEX IF NOT EXISTS app_deployments_app_idx
    ON app_deployments (app_id);
CREATE INDEX IF NOT EXISTS app_deployments_target_idx
    ON app_deployments (target);
