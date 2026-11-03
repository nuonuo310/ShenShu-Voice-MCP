-- Standalone, staging-only Render -> Kodo probe one-shot lock.
-- Applied ONLY to the confirmed dedicated D1 database after a separate
-- human-approved schema change. This migration is NOT auto-executed.
-- Not related to paid_voice_* operations, reservations, or grants.
-- No destructive rollback: a consumed key is audit evidence forever.
CREATE TABLE IF NOT EXISTS shenshu_kodo_render_single_probe_locks (
  probe_id TEXT PRIMARY KEY NOT NULL,
  claimed_at_ms INTEGER NOT NULL CHECK (claimed_at_ms >= 0)
);
