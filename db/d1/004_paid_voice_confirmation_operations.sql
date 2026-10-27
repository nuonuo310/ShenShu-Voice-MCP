-- Voice V1 P2 explicit-confirmation operation state. Additive only.
--
-- Historical 003 is intentionally not adopted: it cannot represent the
-- nonbillable pending_confirmation state and requires non-null reservation and
-- grant foreign keys before either exists. This migration leaves 001, 002 and
-- any historical 003 objects untouched.
--
-- Admission is ONE SQLite statement (see src/d1-p2-confirmation-operation-store.js).
-- The AFTER UPDATE trigger below reserves the next free daily slot in
-- paid_voice_reservations, issues a grant in paid_voice_grants, consumes that
-- grant, and aborts the whole statement if any step cannot complete. The
-- operation row's CHECK constraint requires the exact derived request/grant
-- identifiers, so a partial transition cannot commit.
--
-- DORMANT: this table stores the exact proposal text so the authenticated
-- standalone player can display it. Live use requires an approved private
-- at-rest sealing decision; no cloud schema is changed by this file.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS paid_voice_confirmation_operations (
  principal TEXT NOT NULL,
  handle TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action = 'generate_shenshu_voice'),
  text TEXT NOT NULL CHECK(length(text) BETWEEN 1 AND 800),
  text_digest TEXT NOT NULL CHECK(length(text_digest) = 43),
  text_bytes INTEGER NOT NULL CHECK(text_bytes BETWEEN 1 AND 800),
  origin TEXT NOT NULL
    CHECK(origin = 'https://shenshu-voice-mcp-staging.onrender.com'),
  max_daily_calls INTEGER NOT NULL CHECK(max_daily_calls BETWEEN 1 AND 20),
  state TEXT NOT NULL CHECK(state IN (
    'pending_confirmation',
    'confirming',
    'provider_pending',
    'completed',
    'unknown'
  )),
  day_utc TEXT,
  request_id TEXT,
  grant_id TEXT,
  issued_at INTEGER NOT NULL CHECK(issued_at >= 0),
  expires_at INTEGER NOT NULL CHECK(expires_at > issued_at),
  updated_at INTEGER NOT NULL CHECK(updated_at >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(principal, operation_id),
  UNIQUE(principal, handle),
  UNIQUE(request_id),
  UNIQUE(grant_id),
  FOREIGN KEY(request_id) REFERENCES paid_voice_reservations(request_id),
  FOREIGN KEY(grant_id) REFERENCES paid_voice_grants(grant_id),
  CHECK(expires_at - issued_at <= 900000),
  CHECK(request_id IS NULL OR request_id = operation_id),
  CHECK(grant_id IS NULL OR grant_id = 'grant_' || operation_id),
  CHECK(
    (state = 'pending_confirmation'
      AND request_id IS NULL AND grant_id IS NULL AND day_utc IS NULL) OR
    (state = 'confirming'
      AND request_id IS NULL AND grant_id IS NULL AND day_utc IS NULL) OR
    (state IN ('provider_pending', 'completed', 'unknown')
      AND request_id IS NOT NULL AND grant_id IS NOT NULL AND day_utc IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS paid_voice_confirmation_operations_pending
  ON paid_voice_confirmation_operations(principal, state, expires_at);

CREATE INDEX IF NOT EXISTS paid_voice_confirmation_operations_day
  ON paid_voice_confirmation_operations(day_utc, state);

CREATE TRIGGER IF NOT EXISTS paid_voice_confirmation_admit
AFTER UPDATE OF state ON paid_voice_confirmation_operations
WHEN NEW.state = 'provider_pending' AND OLD.state = 'pending_confirmation'
BEGIN
  -- Choose the first free slot in [1, max_daily_calls] for this principal/day.
  -- A recursive CTE is wrapped in a subquery because SQLite does not accept a
  -- top-level WITH before INSERT inside a trigger body.
  INSERT OR IGNORE INTO paid_voice_reservations
    (request_id, principal, day_utc, slot)
  SELECT NEW.request_id, NEW.principal, NEW.day_utc, slots.slot
  FROM (
    WITH RECURSIVE slots(slot) AS (
      SELECT 1
      UNION ALL
      SELECT slot + 1 FROM slots WHERE slot < NEW.max_daily_calls
    )
    SELECT slot FROM slots
  ) AS slots
  WHERE NOT EXISTS (
    SELECT 1 FROM paid_voice_reservations existing
    WHERE existing.principal = NEW.principal
      AND existing.day_utc = NEW.day_utc
      AND existing.slot = slots.slot
  )
  ORDER BY slots.slot
  LIMIT 1;

  SELECT RAISE(ABORT, 'quota_denied')
  WHERE NOT EXISTS (
    SELECT 1 FROM paid_voice_reservations
    WHERE request_id = NEW.request_id
      AND principal = NEW.principal
      AND day_utc = NEW.day_utc
  );

  INSERT INTO paid_voice_grants (grant_id, request_id, principal, state)
  SELECT NEW.grant_id, NEW.request_id, NEW.principal, 'issued'
  WHERE EXISTS (
    SELECT 1 FROM paid_voice_reservations
    WHERE request_id = NEW.request_id AND principal = NEW.principal
  );

  SELECT RAISE(ABORT, 'grant_denied')
  WHERE NOT EXISTS (
    SELECT 1 FROM paid_voice_grants
    WHERE grant_id = NEW.grant_id
      AND request_id = NEW.request_id
      AND principal = NEW.principal
  );

  UPDATE paid_voice_grants
  SET state = 'consumed', consumed_at = CURRENT_TIMESTAMP
  WHERE grant_id = NEW.grant_id
    AND request_id = NEW.request_id
    AND principal = NEW.principal
    AND state = 'issued';

  SELECT RAISE(ABORT, 'grant_consume_denied')
  WHERE NOT EXISTS (
    SELECT 1 FROM paid_voice_grants
    WHERE grant_id = NEW.grant_id AND state = 'consumed'
  );
END;
