/** Fixed SQL for the additive paid_voice_operations candidate. */
export const D1_OPERATION_SQL = Object.freeze({
  selectByKey: `
SELECT
  o.principal,
  o.operation_id,
  o.request_id,
  o.grant_id,
  o.action,
  o.text_digest,
  o.text_bytes,
  o.state,
  o.result_ref,
  o.issued_at,
  o.expires_at,
  r.principal AS reservation_principal,
  r.day_utc,
  r.slot,
  g.principal AS grant_principal,
  g.request_id AS grant_request_id,
  g.state AS grant_state
FROM paid_voice_operations AS o
LEFT JOIN paid_voice_reservations AS r ON r.request_id = o.request_id
LEFT JOIN paid_voice_grants AS g ON g.grant_id = o.grant_id
WHERE o.principal = ?1 AND o.operation_id = ?2
LIMIT 2`.trim(),
  insert: `
INSERT INTO paid_voice_operations
  (principal, operation_id, request_id, grant_id, action, text_digest,
   text_bytes, state, result_ref, issued_at, expires_at)
SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, 'admitted', NULL, ?8, ?9
WHERE EXISTS (
  SELECT 1 FROM paid_voice_reservations AS r
  WHERE r.request_id = ?3 AND r.principal = ?1
)
AND EXISTS (
  SELECT 1 FROM paid_voice_grants AS g
  WHERE g.grant_id = ?4 AND g.request_id = ?3
    AND g.principal = ?1 AND g.state = 'issued'
)
RETURNING principal, operation_id, request_id, grant_id, state`.trim(),
  reserveStrict: `
WITH RECURSIVE slots(slot) AS (
  SELECT 1
  UNION ALL
  SELECT slot + 1 FROM slots WHERE slot < ?4
)
INSERT INTO paid_voice_reservations
  (request_id, principal, day_utc, slot)
SELECT ?1, ?2, ?3, slots.slot
FROM slots
WHERE NOT EXISTS (
  SELECT 1 FROM paid_voice_reservations AS existing
  WHERE existing.principal = ?2
    AND existing.day_utc = ?3
    AND existing.slot = slots.slot
)
ORDER BY slots.slot
LIMIT 1
RETURNING request_id, slot`.trim(),
  issueStrict: `
INSERT INTO paid_voice_grants
  (grant_id, request_id, principal, state)
SELECT ?1, r.request_id, r.principal, 'issued'
FROM paid_voice_reservations AS r
WHERE r.request_id = ?2 AND r.principal = ?3
RETURNING grant_id`.trim(),
  markProviderPending: `
UPDATE paid_voice_operations
SET state = 'provider_pending', updated_at = CURRENT_TIMESTAMP
WHERE principal = ?1
  AND operation_id = ?2
  AND request_id = ?3
  AND state = 'admitted'
  AND expires_at > ?4
RETURNING principal, operation_id, request_id, state`.trim(),
  markCompleted: `
UPDATE paid_voice_operations
SET state = 'completed', result_ref = ?5, updated_at = CURRENT_TIMESTAMP
WHERE principal = ?1
  AND operation_id = ?2
  AND request_id = ?3
  AND state = 'provider_pending'
  AND expires_at > ?4
RETURNING principal, operation_id, request_id, state, result_ref`.trim(),
  markUnknown: `
UPDATE paid_voice_operations
SET state = 'unknown', result_ref = NULL, updated_at = CURRENT_TIMESTAMP
WHERE principal = ?1
  AND operation_id = ?2
  AND request_id = ?3
  AND state IN ('admitted','provider_pending')
  AND expires_at > ?4
RETURNING principal, operation_id, request_id, state`.trim(),
});
