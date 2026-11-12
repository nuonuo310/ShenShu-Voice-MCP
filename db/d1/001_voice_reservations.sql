-- Dedicated Cloudflare D1 database; apply only after review.
-- One reservation = one possibly billable attempt; never auto-refund.
CREATE TABLE IF NOT EXISTS paid_voice_reservations (
  request_id TEXT PRIMARY KEY NOT NULL,
  principal TEXT NOT NULL,
  day_utc TEXT NOT NULL,
  slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 20),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (principal, day_utc, slot)
);
CREATE INDEX IF NOT EXISTS paid_voice_reservations_by_owner_day
ON paid_voice_reservations(principal, day_utc);
