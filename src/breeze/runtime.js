/** Additive staging-only composition. Any missing input keeps Breeze absent. */
import {timingSafeEqual} from 'node:crypto';
import {resolveProtectedResourceIdentity} from '../protected-resource-identity.js';
import {requireCanonicalPrincipal} from '../canonical-principal.js';
import {PRIVATE_TEXT_MASTER_KEY_ENV} from '../v1-p2-staging-sealed-closure.js';
import {createBreezeJobStore} from './job-store.js';
import {createBreezeWorkerHandler} from './worker-http.js';
export async function composeBreezeRuntime({env,currentSha,createD1Client,identityVerifier}={}){
 if(env?.SHENSHU_BREEZE_ENABLED!=='1')return null;
 try{
  const identity=resolveProtectedResourceIdentity(env);
  if(!identity.ok||!identity.staging||typeof identityVerifier!=='function'||!currentSha||env.SHENSHU_BREEZE_APPROVED_SHA!==currentSha||env.SHENSHU_DESKTOP_04_SILVER_UI_ENABLED!=='1')return null;
  const principal=requireCanonicalPrincipal(env.SHENSHU_BREEZE_WORKER_PRINCIPAL),token=env.SHENSHU_BREEZE_WORKER_TOKEN;
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token)||Buffer.from(token,'base64url').length!==32)return null;
  const raw=env[PRIVATE_TEXT_MASTER_KEY_ENV],masterKey=Buffer.from(raw,/^[A-Za-z0-9_-]{43}$/.test(raw)?'base64url':'base64');
  const client=createD1Client({env});for(const table of ['breeze_jobs','breeze_job_parts','breeze_workers'])await client.query('SELECT * FROM '+table+' LIMIT 0');
  const jobs=createBreezeJobStore({client,masterKey});
  const workerHandler=createBreezeWorkerHandler({jobs,resolveWorkerPrincipal:req=>{
   const auth=req.headers.authorization,expected='Bearer '+token;
   if(typeof auth!=='string'||Buffer.byteLength(auth)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(auth),Buffer.from(expected)))throw Error('worker_denied');return principal;
  }});
  return {jobs,workerHandler};
 }catch{return null;}
}
