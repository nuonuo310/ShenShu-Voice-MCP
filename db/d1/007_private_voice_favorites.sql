-- Additive only: does not touch paid grants, reservations or operations.
CREATE TABLE IF NOT EXISTS voice_favorites (
 principal TEXT NOT NULL, id TEXT NOT NULL, created_at TEXT NOT NULL,
 upload_id TEXT NOT NULL, part_count INTEGER NOT NULL CHECK(part_count BETWEEN 1 AND 64),
 sealed_metadata TEXT NOT NULL, PRIMARY KEY(principal,id)
);
CREATE INDEX IF NOT EXISTS voice_favorites_page ON voice_favorites(principal,created_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS voice_favorite_parts (
 principal TEXT NOT NULL, id TEXT NOT NULL, upload_id TEXT NOT NULL,
 part INTEGER NOT NULL CHECK(part BETWEEN 0 AND 63), payload TEXT NOT NULL CHECK(length(payload)<=64000),
 staged_at TEXT NOT NULL, PRIMARY KEY(principal,id,upload_id,part)
);
CREATE TRIGGER IF NOT EXISTS voice_favorites_delete_parts AFTER DELETE ON voice_favorites
BEGIN DELETE FROM voice_favorite_parts WHERE principal=OLD.principal AND id=OLD.id AND upload_id=OLD.upload_id; END;
