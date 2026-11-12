-- OFFLINE CANDIDATE ONLY. Do not execute on an online database yet.
-- Separate from all paid reservation/grant tables; no quota writes.
CREATE TABLE IF NOT EXISTS breeze_jobs (
 principal TEXT NOT NULL,
 id TEXT NOT NULL,
 request_digest TEXT NOT NULL,
 sealed_text TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('queued','claimed','ready','failed','unknown','expired')),
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 claim_token TEXT,
 claim_until INTEGER,
 completed_at INTEGER,
 result_digest TEXT,
 part_count INTEGER,
 duration REAL,
 PRIMARY KEY(principal,id)
);
CREATE INDEX IF NOT EXISTS breeze_jobs_queue ON breeze_jobs(principal,state,created_at,id);
CREATE TABLE IF NOT EXISTS breeze_workers (
 principal TEXT PRIMARY KEY,
 last_seen INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS breeze_job_parts (
 principal TEXT NOT NULL,
 id TEXT NOT NULL,
 part INTEGER NOT NULL CHECK(part BETWEEN 0 AND 63),
 payload TEXT NOT NULL CHECK(length(payload)<=64000),
 PRIMARY KEY(principal,id,part)
);
