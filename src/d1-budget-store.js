/**
 * Cloudflare D1 daily attempt limiter. Candidate only: NOT imported by server.js.
 * One SQLite INSERT statement atomically claims a unique daily slot.
 * Identity MUST be verified upstream by a trusted OAuth resource server.
 * No refund after uncertain billing; no retry here.
 */
const ID = /^[A-Za-z0-9_-]{8,128}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const D1_RESERVE_SQL = [
  "WITH RECURSIVE slots(slot) AS (",
  "  SELECT 1 UNION ALL SELECT slot + 1 FROM slots WHERE slot < ?4",
  ")",
  "INSERT INTO paid_voice_reservations (request_id, principal, day_utc, slot)",
  "SELECT ?1, ?2, ?3, slots.slot FROM slots",
  "WHERE NOT EXISTS (",
  "  SELECT 1 FROM paid_voice_reservations r",
  "  WHERE r.principal = ?2 AND r.day_utc = ?3 AND r.slot = slots.slot",
  ")",
  "ORDER BY slots.slot LIMIT 1",
  "ON CONFLICT DO NOTHING RETURNING request_id",
].join("\n");

export function createD1ReserveAtomic({ db }) {
  if (!db || typeof db.prepare !== "function") throw new Error("missing_d1_binding");
  return async ({ subject, day, requestId, limit }) => {
    if (!ID.test(subject ?? "") || !ID.test(requestId ?? "") ||
        !DAY.test(day ?? "") || !Number.isSafeInteger(limit) ||
        limit < 1 || limit > 20) throw new Error("invalid_reservation");
    const date = new Date(day + "T00:00:00Z");
    if (!Number.isFinite(date.valueOf()) ||
        date.toISOString().slice(0, 10) !== day) throw new Error("invalid_reservation");
    try {
      // One atomic SQLite statement; uniqueness enforces one attempt per ID
      // and at most 'limit' slots per principal/day. Under contention, a
      // constraint conflict can deny an otherwise available slot: fail closed.
      const result = await db.prepare(D1_RESERVE_SQL)
        .bind(requestId, subject, day, limit).first();
      return Object.freeze({ reserved: result?.request_id === requestId });
    } catch {
      // Any D1 quota exhaustion, overload or query failure denies paid use.
      throw new Error("budget_store_unavailable");
    }
  };
}
