-- 0004_cloud_run_deployments.sql
-- Adds app_deployments table for tracking multi-target deployment metadata.

CREATE TABLE IF NOT EXISTS app_deployments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    target TEXT NOT NULL,
    service_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    metadata TEXT DEFAULT '{}',
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS app_deployments_app_target_version_idx
    ON app_deployments (app_id, target, version);
CREATE INDEX IF NOT EXISTS app_deployments_app_idx
    ON app_deployments (app_id);
CREATE INDEX IF NOT EXISTS app_deployments_target_idx
    ON app_deployments (target);
