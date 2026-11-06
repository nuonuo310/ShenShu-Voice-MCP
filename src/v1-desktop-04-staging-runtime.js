/** Desktop host composition. Paid OFF by default; no Kodo or public audio URL. */
import {createHash,randomUUID} from 'node:crypto';
import {checkText} from './contract.js';
import {requireCanonicalPrincipal} from './canonical-principal.js';
import {createD1P2ConfirmationOperationStore} from './d1-p2-confirmation-operation-store.js';
import {createV1P2NonbillableProposalBroker} from './v1-p2-nonbillable-proposal-broker.js';
import {createPrivateTextSealer} from './v1-p2-private-text-sealer.js';
import {assessV1P2StagingSealedConfig,PRIVATE_TEXT_MASTER_KEY_ENV} from './v1-p2-staging-sealed-closure.js';
import {createDesktop04AppSurfaceOffline} from './v1-desktop-04-app-surface-offline.js';
import {createDesktopDirect04Offline,DESKTOP_04_VOICE_ID,DESKTOP_04_MODEL_ID} from './v1-desktop-direct-04-offline.js';
import {synthesizeMiniMax} from './minimax-adapter.js';

export const DESKTOP_04_FLAG='SHENSHU_DESKTOP_04_APP_ENABLED';
export const DESKTOP_04_ON_REQUEST_FLAG='SHENSHU_DESKTOP_04_ON_REQUEST_ENABLED';
const PREFIX='desktop04_';
const FLAGS=['SHENSHU_STAGING_FINAL_WIRING_ENABLED','SHENSHU_STAGING_PAID_CONFIRM_ENABLED',
 'SHENSHU_STAGING_REAL_PROVIDER_ENABLED','SHENSHU_STAGING_PRIVATE_AUDIO_ENABLED'];
const SHA=/^[a-f0-9]{40}$/;
function nowMs(clock){const v=clock();const n=v instanceof Date?v.valueOf():v;
 if(!Number.isSafeInteger(n)||n<0)throw Error('desktop04_clock_invalid');return n;}
export function assessDesktop04StagingConfig(env,{currentSha}={}){
 if(env?.[DESKTOP_04_FLAG]!=='1')return 'desktop04_flag_off';
 if(FLAGS.some(flag=>env?.[flag]!=='1'))return 'desktop04_paid_flags_off';
 if(env?.SHENSHU_PRIVATE_FIXTURE_ENABLED!=='1')return 'desktop04_fixture_off';
 const sealed=assessV1P2StagingSealedConfig(env);
 if(sealed!=='sealed_config_ready')return sealed;
 const test=env.NODE_ENV==='test';
 if(!test&&(currentSha!==undefined||env.SHENSHU_AUTH_STATIC_JWKS_TEST_ONLY==='1'))return 'desktop04_test_injection_forbidden';
 const approved=env.SHENSHU_STAGING_APPROVED_SHA;
 const actual=test?(currentSha??env.RENDER_GIT_COMMIT):env.RENDER_GIT_COMMIT;
 if(!SHA.test(approved??'')||!SHA.test(actual??'')||approved!==actual)return 'desktop04_sha_mismatch';
 const key=env.SHENSHU_MINIMAX_API_KEY;
 if(typeof key!=='string'||!key.trim()||Buffer.byteLength(key)>512||/[\x00-\x1f\x7f]/.test(key))return 'desktop04_key_invalid';
 if(env.SHENSHU_MINIMAX_VOICE_ID!==DESKTOP_04_VOICE_ID)return 'desktop04_voice_invalid';
 return 'desktop04_ready';
}

/** Store is the existing sealed, single-statement D1 admission store. */
export function createDesktop04D1Factory({operationStore,resolveVerifiedIdentity,synthesize,clock=Date.now,operationTtlMs,onRequestEnabled=false,maximumDailyCalls=1}={}){
 if(typeof onRequestEnabled!=='boolean'||![1,10].includes(maximumDailyCalls)||
    (onRequestEnabled&&maximumDailyCalls!==10))throw Error('desktop04_policy_invalid');
 if(!operationStore||typeof resolveVerifiedIdentity!=='function'||typeof synthesize!=='function')throw Error('desktop04_unavailable');
 const broker=createV1P2NonbillableProposalBroker({
  operationStore,resolveVerifiedPrincipal:resolveVerifiedIdentity,clock:()=>nowMs(clock),
  makeOperationId:()=>PREFIX+randomUUID().replaceAll('-',''),
  ...(operationTtlMs===undefined?{}:{operationTtlMs}),
 });
 async function resolvePrincipal(request){
  const id=await resolveVerifiedIdentity(request);
  if(id?.verified!==true)throw Error('not_authorized');
  return {verified:true,principal:requireCanonicalPrincipal(id.subject)};
 }
 async function readPending({trustedRequest,principal,handle}){
  const id=await resolvePrincipal(trustedRequest);
  if(id.principal!==principal)throw Error('not_authorized');
  const row=await operationStore.get({principal,handle});
  if(!row||row.principal!==principal||row.handle!==handle||
     !row.operationId.startsWith(PREFIX))throw Error('confirmation_unavailable');
  if(row.state!=='pending_confirmation')throw Error('desktop04_used');
  if(row.expiresAt<=nowMs(clock))throw Error('desktop04_expired');
  return row;
 }
 async function prepareOnRequest({trustedRequest,text,requestKey}){
  const safeText=checkText(text);
  const {principal}=await resolvePrincipal(trustedRequest);
  if(!onRequestEnabled||typeof requestKey!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(requestKey))throw Error('not_authorized');
  // Stable per explicit request and owner, across retries and process restarts.
  const digest=createHash('sha256').update('desktop04-request-v1\0'+principal+'\0'+requestKey).digest('base64url');
  const handle=createHash('sha256').update('desktop04-handle-v1\0'+digest).digest('base64url');
  async function existing(){
   const row=await operationStore.get({principal,handle});
   if(!row)return null;
   if(row.text!==safeText)throw Error('request_key_text_mismatch');
   return row.state==='pending_confirmation'&&row.expiresAt>nowMs(clock)?
    {status:'pending_confirmation',handle,expiresAt:new Date(row.expiresAt).toISOString(),billable:false}:
    {status:'not_generated',reason:row.state==='pending_confirmation'?'expired':'used',retryable:false};
  }
  const previous=await existing();if(previous)return previous;
  const requestBroker=createV1P2NonbillableProposalBroker({operationStore,
   resolveVerifiedPrincipal:resolveVerifiedIdentity,clock:()=>nowMs(clock),makeHandle:()=>handle,
   makeOperationId:()=>PREFIX+'auto_'+digest,...(operationTtlMs===undefined?{}:{operationTtlMs})});
  try{return await requestBroker.initiate({trustedRequest,text:safeText});}
  catch(error){
   // A concurrent insert may already have won. Never manufacture another ID.
   const winner=await existing();if(winner)return winner;throw error;
  }
 }
 return ({verifiedRequest})=>createDesktop04AppSurfaceOffline({
  verifiedRequest,resolveVerifiedPrincipal:resolvePrincipal,broker,clock:()=>nowMs(clock),
  prepareOnRequest:onRequestEnabled?prepareOnRequest:null,
  loadOwnedPending:async input=>{
   const row=await readPending(input);
   return {...row,expiresAt:new Date(row.expiresAt).toISOString()};
  },
  confirmAndGenerate:async({trustedRequest,handle,text})=>{
   const {principal}=await resolvePrincipal(trustedRequest);
   const row=await readPending({trustedRequest,principal,handle});
   if(row.text!==text)throw Error('confirmation_unavailable');
   let claimed=false;
   const confirm=createDesktopDirect04Offline({
    resolveVerifiedPrincipal:resolvePrincipal,makeRequestId:()=>row.operationId,synthesize,
    consumeConfirmedOneUseGrant:async input=>{
     if(input.principal!==principal||input.handle!==handle||input.requestId!==row.operationId||
        input.textDigest!==row.textDigest||input.textBytes!==row.textBytes)throw Error('not_authorized');
     const claim=await operationStore.claim({...input,now:nowMs(clock)});
     if(claim?.claimed!==true)throw Error(claim?.reason==='quota'?'desktop04_daily_limit':'desktop04_used');
     claimed=true;
     if(claim.operationId!==row.operationId||claim.requestId!==row.operationId)throw Error('admission_invalid');
     const attested=await operationStore.attestAdmission({principal,operationId:row.operationId});
     if(attested?.admitted!==true||!Number.isSafeInteger(attested.slot)||attested.slot<1||attested.slot>maximumDailyCalls)throw Error('admission_invalid');
     return {allowed:true,oneTime:true,consumed:true,principal,requestId:row.operationId};
    },
   });
   try{
    const result=await confirm({trustedRequest,handle,text});
    const completed=await operationStore.markCompleted({principal,handle,operationId:row.operationId,now:nowMs(clock)});
    if(completed?.updated!==true)throw Error('completion_unknown');
    return result;
   }catch(error){
    // A claimed/ambiguous attempt is never refunded, regenerated or replayed.
    if(claimed)try{await operationStore.markUnknown({principal,handle,operationId:row.operationId,now:nowMs(clock)});}catch{}
    if(!claimed&&['desktop04_daily_limit','desktop04_used'].includes(error?.message))throw error;
    throw Error('desktop04_outcome_unavailable');
   }
  },
 });
}

export async function composeDesktop04StagingRuntime({env,composed,createD1Client,currentSha,fetchImpl=globalThis.fetch,clock=Date.now,operationTtlMs}={}){
 const code=assessDesktop04StagingConfig(env,{currentSha});
 if(code!=='desktop04_ready')return Object.freeze({code,factory:null});
 try{
  if(composed?.sealedProposalEnabled!==true||typeof composed.identityVerifier!=='function')throw Error('sealed_unavailable');
  const raw=env[PRIVATE_TEXT_MASTER_KEY_ENV];
  const masterKey=Buffer.from(raw,/^[A-Za-z0-9_-]{43}$/.test(raw)?'base64url':'base64');
  const textSealer=createPrivateTextSealer({masterKey});
  const onRequestEnabled=env[DESKTOP_04_ON_REQUEST_FLAG]==='1';
  const maximumDailyCalls=onRequestEnabled?10:1;
  const operationStore=createD1P2ConfirmationOperationStore({client:createD1Client({env}),maximumDailyCalls,textSealer,desktopOnRequest:onRequestEnabled});
  const schema=await operationStore.verifySchema();
  if(schema?.ok!==true||schema.sealedText!==true)throw Error('schema_unqualified');
  const synthesize=async({text,modelId,voiceId})=>{
   if(modelId!==DESKTOP_04_MODEL_ID||voiceId!==DESKTOP_04_VOICE_ID)throw Error('provider_config_mismatch');
   return synthesizeMiniMax({
    text,modelId,voiceId,voicePreset:'gentle',
    apiKey:env.SHENSHU_MINIMAX_API_KEY,fetchImpl
   });
  };
  const factory=createDesktop04D1Factory({operationStore,resolveVerifiedIdentity:composed.identityVerifier,synthesize,clock,operationTtlMs,onRequestEnabled,maximumDailyCalls});
  return Object.freeze({code:'desktop04_ready',factory,onRequestEnabled,maximumDailyCalls});
 }catch{return Object.freeze({code:'desktop04_runtime_unavailable',factory:null});}
}
