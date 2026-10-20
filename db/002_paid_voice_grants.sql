CREATE TABLE IF NOT EXISTS paid_voice_grants (
  grant_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE REFERENCES paid_voice_reservations(request_id),
  principal TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'issued' CHECK (state IN ('issued','consumed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS paid_voice_grants_principal_state
  ON paid_voice_grants (principal, state);
