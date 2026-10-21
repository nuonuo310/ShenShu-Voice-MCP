/**
 * P2S Cloudflare D1 durable paid-admission store candidate.
 * Matches the recovered live D1 schema; NOT wired to paid MCP yet.
 *
 * Reservation uses ONE SQLite statement: choose the first free slot in
 * [1, limit], insert it, and RETURNING the row. Existing unique constraints
 * protect both request replay and concurrent slot collisions.
 */
const IDENT=/^[A-Za-z0-9_-]{8,128}$/;
const DAY=/^\d{4}-\d{2}-\d{2}$/;

const RESERVE=`
WITH RECURSIVE slots(slot) AS (
  SELECT 1
  UNION ALL
  SELECT slot + 1 FROM slots WHERE slot < ?4
)
INSERT OR IGNORE INTO paid_voice_reservations
  (request_id, principal, day_utc, slot)
SELECT ?1, ?2, ?3, slots.slot
FROM slots
WHERE NOT EXISTS (
  SELECT 1 FROM paid_voice_reservations existing
  WHERE existing.principal = ?2
    AND existing.day_utc = ?3
    AND existing.slot = slots.slot
)
ORDER BY slots.slot
LIMIT 1
RETURNING request_id, slot`.trim();

const ISSUE=`
INSERT OR IGNORE INTO paid_voice_grants
  (grant_id, request_id, principal, state)
SELECT ?1, r.request_id, r.principal, 'issued'
FROM paid_voice_reservations AS r
WHERE r.request_id = ?2 AND r.principal = ?3
RETURNING grant_id`.trim();

const CONSUME=`
UPDATE paid_voice_grants
SET state = 'consumed', consumed_at = CURRENT_TIMESTAMP
WHERE grant_id = ?1
  AND request_id = ?2
  AND principal = ?3
  AND state = 'issued'
RETURNING grant_id`.trim();

export const D1_PAID_SQL=Object.freeze({reserve:RESERVE,issue:ISSUE,consume:CONSUME});

function valid({subject,day,requestId,limit}) {
  if(!IDENT.test(subject??"")||!IDENT.test(requestId??"")||
     !DAY.test(day??"")||!Number.isSafeInteger(limit)||limit<1||limit>20) return false;
  const d=new Date(day+"T00:00:00.000Z");
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0,10)===day;
}
function prepare(db,sql,params) {
  if(!db||typeof db.prepare!=="function") throw Error("missing_d1_binding");
  const stmt=db.prepare(sql);
  if(!stmt||typeof stmt.bind!=="function") throw Error("invalid_d1_binding");
  const bound=stmt.bind(...params);
  if(!bound||typeof bound.first!=="function") throw Error("invalid_d1_binding");
  return bound;
}
export function createD1PaidStore({db}) {
  if(!db||typeof db.prepare!=="function") throw Error("missing_d1_binding");
  return Object.freeze({
    async reserveAtomic({subject,day,requestId,limit}) {
      if(!valid({subject,day,requestId,limit})) throw Error("invalid_reservation");
      try {
        const row=await prepare(db,RESERVE,[requestId,subject,day,limit]).first();
        return row?.request_id===requestId &&
          Number.isSafeInteger(row?.slot) && row.slot>=1 && row.slot<=limit
          ? {reserved:true,slot:row.slot}
          : {reserved:false};
      } catch {throw Error("budget_store_unavailable");}
    },
    async issue({grantId,requestId,subject}) {
      if(!IDENT.test(grantId??"")||!IDENT.test(requestId??"")||!IDENT.test(subject??""))
        throw Error("invalid_grant");
      try {
        const row=await prepare(db,ISSUE,[grantId,requestId,subject]).first();
        return {issued:row?.grant_id===grantId};
      } catch {throw Error("grant_store_unavailable");}
    },
    async consume({grantId,requestId,subject}) {
      if(!IDENT.test(grantId??"")||!IDENT.test(requestId??"")||!IDENT.test(subject??""))
        throw Error("invalid_grant");
      try {
        const row=await prepare(db,CONSUME,[grantId,requestId,subject]).first();
        return {consumed:row?.grant_id===grantId};
      } catch {throw Error("grant_store_unavailable");}
    }
  });
}
