/**
 * Adapter from Cloudflare D1 REST query() to paid-store contract.
 * Never builds SQL from caller values; only parameter arrays vary.
 */
import {D1_PAID_SQL} from "./d1-paid-store.js";
const IDENT=/^[A-Za-z0-9_-]{8,128}$/;
const DAY=/^\d{4}-\d{2}-\d{2}$/;
function singleRow(rows) {
  if (!Array.isArray(rows) || rows.length > 1) throw Error("d1_result_invalid");
  return rows[0] ?? null;
}
export function createD1HttpPaidStore({client}) {
  if(!client||typeof client.query!=="function")throw Error("missing_d1_http_client");
  return Object.freeze({
    async reserveAtomic({subject,day,requestId,limit}) {
      if(!IDENT.test(subject??"")||!IDENT.test(requestId??"")||!DAY.test(day??"")||
         !Number.isSafeInteger(limit)||limit<1||limit>20)throw Error("invalid_reservation");
      const row=singleRow(await client.query(D1_PAID_SQL.reserve,[requestId,subject,day,limit]));
      if(row===null)return {reserved:false};
      if(row.request_id!==requestId||!Number.isSafeInteger(row.slot)||row.slot<1||row.slot>limit)
        throw Error("d1_result_invalid");
      return {reserved:true,slot:row.slot};
    },
    async issue({grantId,requestId,subject}) {
      if(!IDENT.test(grantId??"")||!IDENT.test(requestId??"")||!IDENT.test(subject??""))
        throw Error("invalid_grant");
      const row=singleRow(await client.query(D1_PAID_SQL.issue,[grantId,requestId,subject]));
      if(row===null)return {issued:false};
      if(row.grant_id!==grantId)throw Error("d1_result_invalid");
      return {issued:true};
    },
    async consume({grantId,requestId,subject}) {
      if(!IDENT.test(grantId??"")||!IDENT.test(requestId??"")||!IDENT.test(subject??""))
        throw Error("invalid_grant");
      const row=singleRow(await client.query(D1_PAID_SQL.consume,[grantId,requestId,subject]));
      if(row===null)return {consumed:false};
      if(row.grant_id!==grantId)throw Error("d1_result_invalid");
      return {consumed:true};
    }
  });
}
