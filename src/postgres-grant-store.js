/**
 * P2R durable, one-time server grant store candidate. NOT wired to /paid-mcp.
 * A grant is issued only after budget reservation has already succeeded.
 * Successful consumption is irreversible and happens BEFORE any MiniMax call.
 */
const IDENT=/^[A-Za-z0-9_-]{8,128}$/;
const ISSUE=[
  "INSERT INTO paid_voice_grants (grant_id, request_id, principal, state)",
  "VALUES ($1, $2, $3, 'issued')",
  "ON CONFLICT DO NOTHING RETURNING grant_id"
].join(" ");
const CONSUME=[
  "UPDATE paid_voice_grants",
  "SET state = 'consumed', consumed_at = now()",
  "WHERE grant_id = $1 AND request_id = $2 AND principal = $3 AND state = 'issued'",
  "RETURNING grant_id"
].join(" ");

export const POSTGRES_GRANT_SQL=Object.freeze({issue:ISSUE,consume:CONSUME});

export function createPostgresGrantStore({pool}) {
  if(!pool||typeof pool.connect!=="function") throw Error("missing_durable_pool");
  return Object.freeze({
    async issue({grantId,requestId,subject}) {
      if(!IDENT.test(grantId??"")||!IDENT.test(requestId??"")||!IDENT.test(subject??""))
        throw Error("invalid_grant");
      const client=await pool.connect();
      try {
        const row=await client.query(ISSUE,[grantId,requestId,subject]);
        return {issued:row?.rowCount===1};
      } catch {throw Error("grant_store_unavailable");}
      finally {client.release();}
    },
    async consume({grantId,requestId,subject}) {
      if(!IDENT.test(grantId??"")||!IDENT.test(requestId??"")||!IDENT.test(subject??""))
        throw Error("invalid_grant");
      const client=await pool.connect();
      try {
        const row=await client.query(CONSUME,[grantId,requestId,subject]);
        return {consumed:row?.rowCount===1};
      } catch {throw Error("grant_store_unavailable");}
      finally {client.release();}
    }
  });
}
