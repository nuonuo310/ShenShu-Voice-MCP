-- Recovered baseline from live Cloudflare D1 database shenshu-voice-budget-test
-- on 2026-10-20. Matches the table already present in D1.
CREATE TABLE IF NOT EXISTS paid_voice_reservations (
  request_id TEXT PRIMARY KEY NOT NULL,
  principal TEXT NOT NULL,
  day_utc TEXT NOT NULL,
  slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 20),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (principal, day_utc, slot)
);
