/**
 * Stage-only paid request admission. NOT imported by public server.js.
 * The trusted ingress supplies the OAuth bearer from a verified header;
 * never accept authorization material as a model tool argument.
 * No MiniMax call happens in this module.
 */
import {randomUUID} from "node:crypto";
import {checkText} from "./contract.js";
import {createD1ReserveAtomic} from "./d1-budget-store.js";
import {verifyPaidVoicePolicy} from "./paid-identity-policy.js";

export function createPaidAdmission({verifyToken,db,approvedSubject,expectedIssuer,
  expectedAudience,clock=()=>new Date(),limit=3,makeRequestId=randomUUID}){
 if(typeof verifyToken!=="function"||!db||typeof db.prepare!=="function")
   throw Error("paid_admission_not_configured");
 if(!Number.isSafeInteger(limit)||limit<1||limit>20)throw Error("paid_admission_not_configured");
 const reserve=createD1ReserveAtomic({db});
 return async function admit({trustedBearer,text}){
  const safeText=checkText(text);
  if(typeof trustedBearer!=="string"||!trustedBearer)throw Error("not_authorized");
  // Only the trusted server transport may supply this header-extracted bearer.
  const identity=verifyToken(trustedBearer);
  const now=clock();
  if(!(now instanceof Date)||!Number.isFinite(now.valueOf()))throw Error("clock_error");
  const policy=verifyPaidVoicePolicy({identity,approvedSubject,expectedIssuer,
    expectedAudience,nowSeconds:Math.floor(now.getTime()/1000)});
  const requestId=makeRequestId();
  const grant=await reserve({subject:policy.subject,day:now.toISOString().slice(0,10),requestId,limit});
  if(grant.reserved!==true)throw Error("budget_denied");
  // No serializable boolean grant passed to clients. This is a server-side
  // outcome only. Future paid gateway must bind to the exact invocation.
  return Object.freeze({requestId,subject:policy.subject,text:safeText,admitted:true});
 };
}
