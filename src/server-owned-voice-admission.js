/** Offline-capable server-owned admission callback. NOT mounted on a paid MCP route. */
import {randomUUID} from "node:crypto";
const ID=/^[A-Za-z0-9_-]{8,128}$/;
export function createServerOwnedVoiceAdmission({verifiedSubject,store,clock=()=>new Date(),makeGrantId=()=> "grant_"+randomUUID().replaceAll("-",""),maximumDailyCalls=3}={}){
 if(!ID.test(verifiedSubject??"")||!store||typeof store.reserveAtomic!=="function"||typeof store.issue!=="function"||typeof store.consume!=="function"||!Number.isSafeInteger(maximumDailyCalls)||maximumDailyCalls<1||maximumDailyCalls>3)throw Error("admission_unavailable");
 return async function authorize({action,textBytes,requestId}={}){
  if(action!=="generate_shenshu_voice"||!Number.isSafeInteger(textBytes)||textBytes<1||textBytes>800||!ID.test(requestId??""))throw Error("not_authorized");
  const now=clock();if(!(now instanceof Date)||Number.isNaN(now.valueOf()))throw Error("clock_error");
  const day=now.toISOString().slice(0,10);
  const reservation=await store.reserveAtomic({subject:verifiedSubject,day,requestId,limit:maximumDailyCalls});
  if(reservation?.reserved!==true)throw Error("budget_denied");
  const grantId=makeGrantId();if(!ID.test(grantId??""))throw Error("grant_denied");
  const issued=await store.issue({grantId,requestId,subject:verifiedSubject});
  if(issued?.issued!==true)throw Error("grant_denied");
  const consumed=await store.consume({grantId,requestId,subject:verifiedSubject});
  if(consumed?.consumed!==true)throw Error("grant_denied");
  return Object.freeze({allowed:true,principal:verifiedSubject,oneTime:true});
 };
}
