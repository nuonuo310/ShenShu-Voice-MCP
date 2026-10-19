/** Durable quota reservation prototype, NOT attached to public /mcp.
 * pool.connect() returns a PostgreSQL client with query() and release().
 * Successful grants are never automatically refunded after uncertain billing.
 */
const IDENT = /^[A-Za-z0-9_-]{8,128}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const INSERT = [
 "INSERT INTO paid_voice_reservations (request_id, principal, day_utc)",
 "VALUES ($1, $2, $3::date)",
 "ON CONFLICT (request_id) DO NOTHING RETURNING request_id"
].join(" ");
const COUNT = [
 "INSERT INTO paid_voice_daily_usage (principal, day_utc, used)",
 "VALUES ($1, $2::date, 1)",
 "ON CONFLICT (principal, day_utc) DO UPDATE",
 "SET used = paid_voice_daily_usage.used + 1",
 "WHERE paid_voice_daily_usage.used < $3 RETURNING used"
].join(" ");
export const POSTGRES_BUDGET_SQL = Object.freeze({ insertReservation: INSERT, incrementCount: COUNT });
export function createPostgresReserveAtomic({ pool }) {
  if (!pool || typeof pool.connect !== "function") throw Error("missing_durable_pool");
  return async ({ subject, day, requestId, limit }) => {
    if (!IDENT.test(subject ?? "") || !IDENT.test(requestId ?? "") ||
      !DAY.test(day ?? "") || !Number.isSafeInteger(limit) || limit < 1 || limit > 20) throw Error("invalid_reservation");
    const d=new Date(day+"T00:00:00.000Z");
    if(!Number.isFinite(d.valueOf())||d.toISOString().slice(0,10)!==day) throw Error("invalid_reservation");
    const client=await pool.connect();
    let began=false;
    try {
      await client.query("BEGIN"); began=true;
      const id=await client.query(INSERT,[requestId,subject,day]);
      if(id?.rowCount!==1){await client.query("ROLLBACK");began=false;return {reserved:false};}
      const count=await client.query(COUNT,[subject,day,limit]);
      if(count?.rowCount!==1){await client.query("ROLLBACK");began=false;return {reserved:false};}
      await client.query("COMMIT");began=false;return {reserved:true};
    } catch {
      if(began) {try{await client.query("ROLLBACK");}catch{}}
      throw Error("budget_store_unavailable");
    } finally {client.release();}
  };
}
