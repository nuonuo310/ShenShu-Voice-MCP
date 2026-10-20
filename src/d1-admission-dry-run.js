/**
 * P2W non-billable D1 admission dry-run.
 * Uses a separate dryrun_ principal namespace so it never consumes the real
 * paid-voice quota for the authenticated user. Still exercises the same live
 * D1 reservation + grant issue + one-time consume implementation.
 */
import {randomUUID} from "node:crypto";
import {createCloudflareD1Http} from "./cloudflare-d1-http.js";
import {createD1HttpPaidStore} from "./d1-http-paid-store.js";

const IDENT=/^[A-Za-z0-9_-]{8,128}$/;
export function createD1AdmissionDryRun({env=process.env,clock=()=>new Date(),idFactory=randomUUID,fetchImpl=fetch}={}) {
  if(env?.SHENSHU_D1_ADMISSION_DRY_RUN_ENABLED!=="1") return null;
  let client,store;
  try {
    client=createCloudflareD1Http({env,fetchImpl});
    store=createD1HttpPaidStore({client});
  } catch {return null;}

  return async function run({verifiedSubject}) {
    if(!IDENT.test(verifiedSubject??"")) throw Error("not_authorized");
    const now=clock();
    if(!(now instanceof Date)||Number.isNaN(now.valueOf())) throw Error("clock_error");
    const day=now.toISOString().slice(0,10);
    const drySubject="dryrun_"+verifiedSubject;
    if(!IDENT.test(drySubject)) throw Error("not_authorized");
    const requestId="dryreq_"+idFactory().replaceAll("-","").slice(0,48);
    const grantId="drygrant_"+idFactory().replaceAll("-","").slice(0,48);
    const reserved=await store.reserveAtomic({
      subject:drySubject,day,requestId,limit:20
    });
    if(reserved?.reserved!==true) throw Error("dryrun_budget_denied");
    const issued=await store.issue({grantId,requestId,subject:drySubject});
    if(issued?.issued!==true) throw Error("dryrun_grant_denied");
    const consumed=await store.consume({grantId,requestId,subject:drySubject});
    if(consumed?.consumed!==true) throw Error("dryrun_grant_denied");
    return Object.freeze({
      admission_verified:true,
      paid_voice_enabled:false,
      real_quota_consumed:false
    });
  };
}
