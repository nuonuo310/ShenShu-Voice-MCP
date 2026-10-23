-- Additive offline candidate. Requires an atomic D1 batch/transaction.
-- Does not alter paid_voice_reservations or paid_voice_grants.
CREATE TABLE IF NOT EXISTS paid_voice_operations (
  principal TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  request_id TEXT NOT NULL UNIQUE,
  grant_id TEXT NOT NULL UNIQUE,
  action TEXT NOT NULL CHECK(action = 'generate_shenshu_voice'),
  text_digest TEXT NOT NULL CHECK(length(text_digest) = 43),
  text_bytes INTEGER NOT NULL CHECK(text_bytes BETWEEN 1 AND 800),
  state TEXT NOT NULL CHECK(state IN ('admitted','provider_pending','completed','unknown')),
  result_ref TEXT CHECK(result_ref IS NULL OR length(result_ref) BETWEEN 8 AND 256),
  issued_at INTEGER NOT NULL CHECK(issued_at >= 0),
  expires_at INTEGER NOT NULL CHECK(expires_at > issued_at),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(principal, operation_id),
  FOREIGN KEY(request_id) REFERENCES paid_voice_reservations(request_id),
  FOREIGN KEY(grant_id) REFERENCES paid_voice_grants(grant_id),
  CHECK(expires_at - issued_at <= 900000),
  CHECK(
    (state = 'completed' AND result_ref IS NOT NULL) OR
    (state <> 'completed' AND result_ref IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS paid_voice_operations_state_expiry
  ON paid_voice_operations(state, expires_at);
