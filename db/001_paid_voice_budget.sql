CREATE TABLE IF NOT EXISTS paid_voice_daily_usage (
 principal TEXT NOT NULL,
 day_utc DATE NOT NULL,
 used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0 AND used <= 20),
 PRIMARY KEY (principal, day_utc)
);
CREATE TABLE IF NOT EXISTS paid_voice_reservations (
 request_id TEXT PRIMARY KEY,
 principal TEXT NOT NULL,
 day_utc DATE NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 state TEXT NOT NULL DEFAULT 'reserved' CHECK (state = 'reserved')
);
CREATE INDEX IF NOT EXISTS paid_voice_reservations_principal_day ON paid_voice_reservations (principal, day_utc);
