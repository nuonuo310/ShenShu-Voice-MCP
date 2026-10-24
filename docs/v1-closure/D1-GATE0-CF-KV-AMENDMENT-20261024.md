# Voice V1 D1 Gate 0 amendment — reserved _cf_KV (2026-10-24)

Authority: ShenShu total control. Parent schema freeze PR #106 head `433e5bd74d27b4b3e7d13a48384556a21a943ddc`. This is a narrow evidence-backed exception to the operator Gate 0 empty-object criterion, not a change to 001/002/003 SQL or an approval to skip later gates.

## Grounded observations
User supplied D1 Studio screenshots for the dedicated target `shenshu-voice-v1-qualification-20261024`, UUID `234913cd-8901-4607-8147-31c4a4317111`. Executing the frozen Gate 0 `sqlite_master WHERE name NOT LIKE 'sqlite_%'` returned exactly one object: `type=table, name=_cf_KV, tbl_name=_cf_KV`. A second read-only query filtering both `sqlite_%` and `_cf_%` returned zero rows. No 001/002/003 DDL was executed.

Cloudflare primary source: https://developers.cloudflare.com/d1/best-practices/import-export-data/ (reviewed 2026-10-24). Official D1 docs explicitly identify `_cf_KV` as a reserved underlying-storage table; it cannot be queried and its reads/writes are not charged. The example database table listing includes `_cf_KV`. This is sufficient to classify that exact object as a known D1 internal table.

## Narrow Gate 0 rule
For this exact new D1 target only, a preflight result consisting solely of the Cloudflare-reserved `_cf_KV` table is acceptable as an internal exception, provided that:
- target name AND UUID are freshly checked in the dashboard before DDL, and account identity is verified independently;
- `SELECT type,name,tbl_name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type,name` returns 0 rows;
- a separate exact-name check verifies no unexpected object (including other `_cf_%` names) besides `_cf_KV` and any SQLite internals; DO NOT blanket-allow arbitrary `_cf_%` objects;
- `PRAGMA foreign_keys` is 1, `PRAGMA foreign_key_check` returns no rows, and `sqlite_version()` is recorded in the actual executing connection;
- frozen 001/002/003 canonical Git hashes remain unchanged.
This amendment is a clarification to the schema freeze's Gate 0, not an authorization to ignore unexpected user tables/indexes or to auto-repair drift.

## Status and scope
Observed `_cf_KV` is not a blocker. Business-object check observed 0 rows. Gate 0 internal-table classification PASS, but **full Gate 0 remains pending** fresh target/account identity and the remaining foreign-key/version checks before first live DDL. Previous user approval covers 001/002/003 on this target subject to all safety gates; do not silently assume missing checks passed.

Next operator step should be a single bounded read-only preflight, followed by a separate total-control decision to release Gate A (001 only) after all checks. Never submit 001/002/003 together. No retries or DROP on partial failure. Old `shenshu-voice-budget-test` UUID `c39a6895-7028-4f59-a100-1455b92c96c1` remains forbidden.

Strict Voice V1 2/9, B1–B4 open. This document creates no Worker, D1 table or row; no Cloudflare API, migration, provider, credential, Render/connector or production operation performed by the assistant.
