-- G0dLog baseline: SQLite-only deployment, owner terminology, stable public slugs,
-- permanent publication snapshots and 90-day audit retention metadata.
PRAGMA foreign_keys=OFF;
ALTER TABLE users ADD COLUMN slug text;
UPDATE users SET slug = lower(replace(replace(username, ' ', '-'), '_', '-')) || '-' || substr(id, 1, 8) WHERE slug IS NULL OR slug = '';
UPDATE users SET role = 'owner' WHERE role = 'admin';
CREATE UNIQUE INDEX IF NOT EXISTS users_slug_unique ON users (slug);
ALTER TABLE article_versions ADD COLUMN kind text DEFAULT 'autosave' NOT NULL;
CREATE TABLE IF NOT EXISTS slug_history (
  id text PRIMARY KEY NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  slug text NOT NULL,
  created_at text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS slug_history_slug_unique ON slug_history (slug);
CREATE INDEX IF NOT EXISTS slug_history_resource_idx ON slug_history (resource_type, resource_id);
CREATE TABLE IF NOT EXISTS audit_logs (
  id text PRIMARY KEY NOT NULL,
  actor_id text,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  metadata text,
  created_at text NOT NULL,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON UPDATE no action ON DELETE set null
);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS audit_logs_resource_idx ON audit_logs (resource_type, resource_id);
PRAGMA foreign_keys=ON;
