/**
 * P2R: compose verified identity + durable daily reservation + one-use grant.
 * NOT wired to MCP and does not call MiniMax.
 *
 * The grant is server-generated, never accepted from tool arguments, never
 * returned to the client, and is consumed before a paid upstream attempt.
 * If consumption/store state is uncertain, fail closed and do not call TTS.
 */
import {randomUUID} from "node:crypto";

const IDENT=/^[A-Za-z0-9_-]{8,128}$/;
export function createDurablePaidAuthorizer({
  resolveVerifiedPrincipal,
  reserveAtomic,
  grantStore,
  maximumDailyCalls=3,
  clock=()=>new Date(),
  makeRequestId=randomUUID,
  makeGrantId=randomUUID,
}) {
  if(typeof resolveVerifiedPrincipal!=="function"||
     typeof reserveAtomic!=="function"||
     !grantStore||typeof grantStore.issue!=="function"||
     typeof grantStore.consume!=="function")
    throw Error("missing_security_dependency");
  if(!Number.isSafeInteger(maximumDailyCalls)||maximumDailyCalls<1||maximumDailyCalls>20)
    throw Error("invalid_budget");

  return async function authorize({trustedRequest,textBytes}) {
    if(!Number.isSafeInteger(textBytes)||textBytes<1||textBytes>800)
      throw Error("invalid_text_size");
    const identity=await resolveVerifiedPrincipal(trustedRequest);
    if(!identity||identity.verified!==true||!IDENT.test(identity.subject??""))
      throw Error("not_authorized");
    const now=clock();
    if(!(now instanceof Date)||Number.isNaN(now.valueOf())) throw Error("clock_error");
    const day=now.toISOString().slice(0,10);
    const requestId=makeRequestId();
    const grantId=makeGrantId();
    if(!IDENT.test(requestId)||!IDENT.test(grantId)) throw Error("invalid_request_id");

    const reservation=await reserveAtomic({
      subject:identity.subject,day,requestId,limit:maximumDailyCalls
    });
    if(reservation?.reserved!==true) throw Error("budget_denied");

    // No refund if anything after reservation is uncertain: conservative billing guard.
    const issued=await grantStore.issue({
      grantId,requestId,subject:identity.subject
    });
    if(issued?.issued!==true) throw Error("grant_denied");

    const consumed=await grantStore.consume({
      grantId,requestId,subject:identity.subject
    });
    if(consumed?.consumed!==true) throw Error("grant_denied");

    // grantId deliberately not exposed beyond this server-side authorizer.
    return Object.freeze({
      allowed:true,
      principal:identity.subject,
      oneTime:true,
      requestId,
    });
  };
}
