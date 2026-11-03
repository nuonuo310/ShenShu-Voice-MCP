-- Disposable offline databases only.
--
-- A5 closure must NEVER drop, truncate or rewrite qualification/live rows that
-- are evidence of an ambiguous outcome. This script exists so a local
-- node:sqlite semantic fixture can be reset; it is not a live rollback plan.

DROP TRIGGER IF EXISTS paid_voice_confirmation_admit;
DROP INDEX IF EXISTS paid_voice_confirmation_operations_day;
DROP INDEX IF EXISTS paid_voice_confirmation_operations_pending;
DROP TABLE IF EXISTS paid_voice_confirmation_operations;
