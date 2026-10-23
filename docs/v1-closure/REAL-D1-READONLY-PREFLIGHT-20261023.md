# Voice V1 — real D1 read-only schema preflight and next authorization gate (2026-10-23)

**Status: READ-ONLY BASELINE ACCEPTED AT OBSERVED SCOPE. NO DDL OR REAL WRITE AUTHORIZED. STRICT V1 2/9.**

## Evidence provenance
User manually inspected Cloudflare D1 Studio and supplied screenshots in ChatGPT on 2026-10-23. These are user-observed screenshots, not programmatic Cloudflare API attestation. The target shown is `shenshu-voice-budget-test`, UUID `c39a6895-7028-4f59-a100-1455b92c96c1`. The Workers overview showed 0/100000 requests today and existing Workers; D1 overview showed 1/10 databases, 0/5M reads, 0/100k writes, 45.06 KB/5 GB storage. This is UI evidence of Free quotas, not proof of billing/card status, permission to create new resources, or absence of charges.

## Actual read-only checks reported by screenshots
- D1 overview: 2 tables. Studio names `paid_voice_reservations` and `paid_voice_grants`. No `paid_voice_operations` table visible.
- `sqlite_master`: 8 objects, including two tables, indexes `paid_voice_reservations_by_owner_day` and `paid_voice_grants_principal_state`, primary key and unique autoindexes.
- `PRAGMA table_info('paid_voice_reservations')`: five columns `request_id TEXT PRIMARY KEY NOT NULL`, `principal TEXT NOT NULL`, `day_utc TEXT NOT NULL`, `slot INTEGER NOT NULL`, `created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`.
- `PRAGMA table_info('paid_voice_grants')`: six columns `grant_id TEXT PRIMARY KEY NOT NULL`, `request_id TEXT NOT NULL`, `principal TEXT NOT NULL`, `state TEXT NOT NULL DEFAULT 'issued'`, `created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`, `consumed_at TEXT` nullable.
- `PRAGMA foreign_key_list('paid_voice_grants')`: `request_id -> paid_voice_reservations.request_id`.
- `PRAGMA foreign_key_check`: 0 rows in observed Studio query.
- `PRAGMA foreign_keys`: 1 in observed Studio connection. Do not extrapolate this connection-level result to future Worker connections.
- `PRAGMA index_list('paid_voice_reservations')` unique autoindex `sqlite_autoindex_paid_voice_reservations_2`; `PRAGMA index_info` gives exactly `principal, day_utc, slot` in order.
- `PRAGMA index_list('paid_voice_grants')` unique autoindex `sqlite_autoindex_paid_voice_grants_2`; `PRAGMA index_info` gives exactly `request_id`.
- Source DDL `sqlite_master.sql` CHECK string checks: reservation `slot BETWEEN 1 AND 20` PASS, grant `state IN ('issued','consumed')` PASS. Opposite-column CHECK result is expected, not a failure.
- Complete DDL text was truncated by Studio, so this does not prove byte-for-byte schema equality or every constraint/index nuance. No live table row-count/namespace-occupancy check was performed.

## Decision
Accept baseline 001/002 **observed structural preflight** only. Existing `shenshu-voice-budget-test` may contain historic rows and may be shared with prior tests; do not claim isolated/empty. No new D1 database or Worker is needed for read-only review, but do not assume reuse is safe for qualification until occupancy, existing service bindings and test principal isolation are checked.

Candidate `db/d1/003_paid_voice_operations.sql` remains a repository-only migration, not applied to real D1. The signed Worker bridge and HMAC are dormant. Before real-cloud nonbillable qualification, require:
1. independently verify account ID, D1 UUID/name, existing bindings/consumers, Free/no-card state, and permission to deploy Worker without card; no secrets in evidence;
2. review exact 003 migration DDL, additive behavior, index/FK compatibility, rollback/no-drop policy and current D1 schema drift;
3. prepare an explicit single-run budget: test-only namespace, approved UTC day(s), exact maximum requests, writes/rows, and STOP on ambiguity, no automatic retries or cleanup;
4. qualify Worker HMAC authentication and real D1 atomic rollback/concurrency/RETURNING with no MiniMax/provider calls, separate staging resources and no public paid MCP endpoint;
5. user/total-control separately authorizes specific cloud creation, migration and write actions. A generic 'continue' is not permission for DDL or cloud deployment.

The previous S3 D1 packet's 8-row limit (4 reservations+4 grants) does not account for 003 operation rows; if testing the full four-statement operation flow, budget must include **up to 12 new rows** (4 reservations+4 grants+4 operations) plus explicit rollback/negative-probe bounds. Do not silently reuse the older 8-row authorization packet.

## Freeze status
Strict 2/9; B1 iPhone audible still failed, B2 real atomic D1 unqualified, B3 private durable result delivery unqualified, B4 no authorized real MiniMax E2E. No V1 freeze.

## Current turn operations
Only read-only GitHub code inspection and writing this GitHub evidence/decision file and Draft PR. No Cloudflare API/D1 query, write, DDL, Worker creation/deploy, Render/Auth0 changes, credentials, MiniMax, connector refresh or merge performed by assistant. User's D1 Studio actions were read-only.
