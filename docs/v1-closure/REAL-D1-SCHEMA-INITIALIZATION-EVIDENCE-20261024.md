# Voice V1 real D1 qualification schema initialization — user-observed completion (2026-10-24)

## Evidence class and scope
USER-OPERATED REAL CLOUDFLARE D1 STUDIO, SCREENSHOTS SUPPLIED IN CHAT. Assistant did not call Cloudflare API or perform DDL directly. The authorized target is `shenshu-voice-v1-qualification-20261024`, UUID `234913cd-8901-4607-8147-31c4a4317111`. Old database `shenshu-voice-budget-test` was not targeted. User explicitly approved sequential 001/002/003 schema initialization subject to gated checks.

## Gate 0
- Target name/UUID matched Cloudflare overview, business tables initially 0.
- Reserved Cloudflare internal `_cf_KV` table found, classified in PR #107; filtered business-object query returned 0 rows.
- `PRAGMA foreign_keys` returned 1, `PRAGMA foreign_key_check` returned 0 rows.
- `sqlite_version()` returned function-not-authorized, documented in PR #108; no bypass or version claim.
- Free/no-card status user attested. Account ID not independently verified by API; retain as limitation.

## Executed schema gates
- Gate A: exact frozen `001_paid_voice_reservations.sql` CREATE TABLE statement executed once successfully. `table_info` showed 5 expected fields. Reservation count 0, two autoindexes, table count 1. `pragma_index_info('sqlite_autoindex_paid_voice_reservations_2')` returned `principal,day_utc,slot`.
- Gate B: first attempt to execute both statements of 002 in D1 Studio executed only the CREATE INDEX statement, which failed `no such table: main.paid_voice_grants`. A subsequent read-only sqlite_master check found neither grant table nor index (0 rows). Recovery was explicitly gated: run original CREATE TABLE statement alone (success), then original CREATE INDEX statement alone (success). No blind rerun of entire file.
- Gate B postflight: reservation_rows 0, grant_rows 0, tables_found 2, grant_index_found 1, grant_auto_indexes 2. Combined read-only constraint query returned `unique_columns=request_id`, `fk_matches=1`, `state_check=1`.
- Gate C: exact frozen `003_paid_voice_operations.sql` CREATE TABLE statement executed successfully; `PRAGMA table_info` returned all 13 expected columns, including composite PK `principal,operation_id`. Original CREATE INDEX `paid_voice_operations_state_expiry(state,expires_at)` executed separately and successfully.
- Gate C postflight: reservations=0, grants=0, operations=0, tables_found=3, indexes_found=2, auto_indexes=7. Combined constraint query: fk_count=2, unique_indexes=3, ttl_check=1, action_check=1. Final `PRAGMA foreign_key_check` returned **4 columns / 0 rows**.

## Qualification decision
**REAL D1 SCHEMA INITIALIZATION ACCEPTED AT OBSERVED SCOPE.** Three business tables, two explicit indexes, seven autoindexes, no business data, and no observed FK violations. This is not proof of real native D1 batch atomicity, Worker signature isolation, cross-principal consistency for arbitrary SQL, concurrency, fail-closed on ambiguous cloud responses, private audio delivery or paid MiniMax E2E. Do not increment strict V1 DONE LINE (still 2/9, B1–B4 open).

## Operational STOP / next authorization
- No further DDL/DML, seed rows, Worker creation/deployment, key provisioning, Render activation or provider calls authorized by this record.
- Future bounded real-cloud qualification must pin account/database identity, reviewed deployable Worker artifact, exact test-only HMAC key lifecycle and write/request budget; explicit approval required separately.
- PR #106 migration manifest frozen Git SHA-256 hashes remain source of truth. No 004 migration, DROP, DELETE or automatic cleanup.
- Assistant GitHub action in this turn: add evidence document + Draft PR only. Cloudflare API operations by assistant 0, MiniMax 0, provider 0, Render/Auth0 changes 0, merge 0.
