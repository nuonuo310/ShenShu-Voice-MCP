CREATE TABLE IF NOT EXISTS paid_voice_grants (
  grant_id TEXT PRIMARY KEY NOT NULL,
  request_id TEXT NOT NULL UNIQUE,
  principal TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'issued' CHECK(state IN ('issued','consumed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consumed_at TEXT,
  FOREIGN KEY(request_id) REFERENCES paid_voice_reservations(request_id)
);
CREATE INDEX IF NOT EXISTS paid_voice_grants_principal_state
  ON paid_voice_grants(principal, state);
