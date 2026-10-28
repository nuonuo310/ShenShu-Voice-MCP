-- Voice V1 P2 private-at-rest proposal text sealing. Additive only.
--
-- 004 remains the authoritative operation, constraint and atomic-admission
-- schema. This migration adds one nullable column so a sealed record can keep
-- the complete authenticated envelope without narrowing the 800 UTF-8 byte V1
-- text contract. The legacy `text` column still holds a short fixed marker.
--
-- Existing 004 rows are left untouched. Sealed mode must fail closed when it
-- encounters one of them; it must never return the historical plaintext.
--
-- Local-only schema preflight:
--   PRAGMA table_info(paid_voice_confirmation_operations);
-- STOP unless `sealed_text` is present as nullable TEXT before enabling the
-- sealed adapter. The adapter also enforces this check in verifySchema().
--
-- No destructive rollback is supplied. Dropping the column would risk losing
-- sealed proposal evidence and is not authorized for remote D1.

ALTER TABLE paid_voice_confirmation_operations
  ADD COLUMN sealed_text TEXT;
