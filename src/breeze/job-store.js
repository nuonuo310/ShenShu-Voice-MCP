/** Isolated durable queue. Caller supplies an already verified owner principal.
 * Atomic UPDATE ... RETURNING claims; expired claims freeze, never requeue.
 * Text/audio encrypted with purpose-bound AEAD. No MiniMax or paid quota imports.
 */
import {createHash,createHmac,createCipheriv,createDecipheriv,hkdfSync,randomBytes} from 'node:crypto';
import {requireCanonicalPrincipal} from '../canonical-principal.js';
import {checkText,validateWav,MAX_WAV_BYTES} from '../contract.js';
const ID=/^voice_[a-f0-9]{32}$/;
const hash=b=>createHash('sha256').update(b).digest('hex');
export function createBreezeJobStore({client,masterKey,clock=Date.now}={}){
 if(typeof client?.query!=='function'||!Buffer.isBuffer(masterKey)||masterKey.length!==32)throw Error('breeze_store_unavailable');
 const key=Buffer.from(hkdfSync('sha256',masterKey,'shenshu-breeze-jobs-v1','aead',32));
 const mac=Buffer.from(hkdfSync('sha256',masterKey,'shenshu-breeze-jobs-v1','identity',32));
 const hmac=s=>createHmac('sha256',mac).update(s).digest('hex');
 function owner(p,id){requireCanonicalPrincipal(p);if(id!==undefined&&!ID.test(id))throw Error('breeze_invalid_job');}
 function seal(p,id,kind,b){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);c.setAAD(Buffer.from(JSON.stringify([p,id,kind])));const value=Buffer.concat([c.update(b),c.final()]);return Buffer.concat([iv,c.getAuthTag(),value]).toString('base64');}
 function open(p,id,kind,s){const b=Buffer.from(s,'base64'),c=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));c.setAAD(Buffer.from(JSON.stringify([p,id,kind])));c.setAuthTag(b.subarray(12,28));return Buffer.concat([c.update(b.subarray(28)),c.final()]);}
 async function expire(p){const now=clock();await client.query("UPDATE breeze_jobs SET state='expired' WHERE principal=? AND state='queued' AND expires_at<=?",[p,now]);await client.query("UPDATE breeze_jobs SET state='unknown' WHERE principal=? AND state='claimed' AND claim_until<=?",[p,now]);}
 async function row(p,id){owner(p,id);await expire(p);const rows=await client.query('SELECT * FROM breeze_jobs WHERE principal=? AND id=?',[p,id]);if(!rows[0])throw Error('breeze_not_found');return rows[0];}
 return Object.freeze({
  async available(principal){owner(principal);const rows=await client.query('SELECT last_seen FROM breeze_workers WHERE principal=?',[principal]);return !!rows[0]&&rows[0].last_seen>clock()-30000;},
  async enqueue(principal,{requestKey,text}){
   owner(principal);checkText(text);if(typeof requestKey!=='string'||!/^[-A-Za-z0-9_]{8,100}$/.test(requestKey))throw Error('breeze_invalid_key');
   const id='voice_'+hmac(JSON.stringify([principal,requestKey])).slice(0,32),digest=hmac(text),now=clock();
   await client.query("INSERT INTO breeze_jobs(principal,id,request_digest,sealed_text,state,created_at,expires_at) VALUES(?,?,?,?,'queued',?,?) ON CONFLICT(principal,id) DO NOTHING",[principal,id,digest,seal(principal,id,'text',Buffer.from(text)),now,now+1200000]);
   const r=await row(principal,id);if(r.request_digest!==digest)throw Error('breeze_key_conflict');return {id,state:r.state};
  },
  async claim(principal){
   owner(principal);await expire(principal);const now=clock(),token=randomBytes(32).toString('base64url');
   await client.query('INSERT INTO breeze_workers(principal,last_seen) VALUES(?,?) ON CONFLICT(principal) DO UPDATE SET last_seen=excluded.last_seen',[principal,now]);
   const rows=await client.query("UPDATE breeze_jobs SET state='claimed',claim_token=?,claim_until=? WHERE principal=? AND state='queued' AND expires_at>? AND id=(SELECT id FROM breeze_jobs WHERE principal=? AND state='queued' AND expires_at>? ORDER BY created_at,id LIMIT 1) RETURNING *",[token,now+900000,principal,now,principal,now]);
   if(!rows[0])return null;const r=rows[0];return {id:r.id,claimToken:token,text:open(principal,r.id,'text',r.sealed_text).toString('utf8')};
  },
  async complete(principal,{id,claimToken,audioBase64}){
   const r=await row(principal,id);if(r.claim_token!==claimToken)throw Error('breeze_claim_denied');
   if(typeof audioBase64!=='string'||audioBase64.length>Math.ceil(MAX_WAV_BYTES/3)*4)throw Error('breeze_invalid_audio');
   const audio=Buffer.from(audioBase64,'base64');if(audio.toString('base64')!==audioBase64)throw Error('breeze_invalid_audio');const meta=validateWav(audio),digest=hash(audio);
   if(r.state==='ready'){if(r.result_digest!==digest)throw Error('breeze_result_conflict');return {ready:true,id};}
   if(r.state!=='claimed')throw Error('breeze_claim_closed');
   const parts=[];for(let offset=0;offset<audio.length;offset+=47000)parts.push(seal(principal,id,'audio:'+parts.length,audio.subarray(offset,offset+47000)));
   // Same claimant may retry uploading identical parts after a network failure.
   // Existing parts never overwritten: conflicting retries fail authentication.
   for(let i=0;i<parts.length;i++)await client.query('INSERT INTO breeze_job_parts(principal,id,part,payload) VALUES(?,?,?,?) ON CONFLICT(principal,id,part) DO NOTHING',[principal,id,i,parts[i]]);
   const stored=[];for(let i=0;i<parts.length;i+=3){const batch=await client.query('SELECT part,payload FROM breeze_job_parts WHERE principal=? AND id=? AND part>=? AND part<? ORDER BY part',[principal,id,i,Math.min(i+3,parts.length)]);for(const v of batch){if(v.part!==stored.length)throw Error('breeze_incomplete');stored.push(v.payload);}}
   if(stored.length!==parts.length||hash(Buffer.concat(stored.map((value,i)=>open(principal,id,'audio:'+i,value))))!==digest)throw Error('breeze_result_conflict');
   const published=await client.query("UPDATE breeze_jobs SET state='ready',result_digest=?,part_count=?,duration=?,completed_at=? WHERE principal=? AND id=? AND state='claimed' AND claim_token=? AND claim_until>? RETURNING id",[digest,parts.length,meta.durationSeconds,clock(),principal,id,claimToken,clock()]);
   if(!published.length){const latest=await row(principal,id);if(latest.state!=='ready'||latest.result_digest!==digest)throw Error('breeze_claim_closed');}
   return {ready:true,id};
  },
  async fail(principal,{id,claimToken}){owner(principal,id);await client.query("UPDATE breeze_jobs SET state='failed' WHERE principal=? AND id=? AND state='claimed' AND claim_token=?",[principal,id,claimToken]);},
  async poll(principal,id){
   const r=await row(principal,id);if(r.state!=='ready')return {id,state:r.state};const parts=[];
   for(let i=0;i<r.part_count;i+=3){const batch=await client.query('SELECT part,payload FROM breeze_job_parts WHERE principal=? AND id=? AND part>=? AND part<? ORDER BY part',[principal,id,i,Math.min(i+3,r.part_count)]);for(const v of batch){if(v.part!==parts.length)throw Error('breeze_incomplete');parts.push(v.payload);}}
   if(parts.length!==r.part_count)throw Error('breeze_incomplete');const audio=Buffer.concat(parts.map((value,i)=>open(principal,id,'audio:'+i,value)));validateWav(audio);if(hash(audio)!==r.result_digest)throw Error('breeze_invalid_audio');
   return {id,state:'ready',record:{id,text:open(principal,id,'text',r.sealed_text).toString('utf8'),createdAt:new Date(r.completed_at).toISOString(),source:'breeze',generated:true,desktopDirect04:true,voiceLabel:'沈述',durationSeconds:r.duration,audioMimeType:'audio/wav',audioBase64:audio.toString('base64')}};
  }
 });
}
