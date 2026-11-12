/** Manual-only, loopback audition. No cloud queue, Call, paid provider or retries. */
import {readFile,mkdir,writeFile,readdir,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {prepareBreezeSpeech} from './presets.js';
import {synthesizeLocalBreeze} from './local-adapter.js';
import {validateWav} from '../contract.js';
import {buildAuditionPage} from './audition-ui.js';
const validId=id=>typeof id==='string'&&/^[a-f0-9]{32}$/.test(id);
const digest=value=>createHash('sha256').update(value).digest('hex');
const json=(value)=>JSON.stringify(value,null,2)+'\n';
const axes=['voice','natural','integrated','clear','noNarrationOrTrailingEvent'];
export async function createBreezeAuditionHandler({directory,synthesize=synthesizeLocalBreeze,log=()=>{}}={}){
 if(!directory)throw Error('breeze_audition_directory_required');
 await mkdir(directory,{recursive:true,mode:0o700});
 const token=randomBytes(32).toString('hex');let busy=false;
 const logResult=(preset,status)=>log({presetId:preset.id,seed:Number(preset.seed),cfg:Number(preset.cfg_scale),status});
 const read=async(id,file)=>JSON.parse(await readFile(join(directory,id,file),'utf8'));
 async function record(id){
  const request=await read(id,'request.json');let result;
  try{result=await read(id,'result.json');}catch{result={status:'unknown'};}
  let review=null;try{review=await read(id,'review.json');}catch{}
  return {id,presetId:request.presetId,text:request.text,parameters:request.parameters,createdAt:request.createdAt,...result,review};
 }
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; media-src 'self' blob:; img-src 'self' data:; frame-ancestors 'none'; form-action 'none'");
  const reply=(status,value)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(json(value));};
  const address=req.socket?.localAddress;
  if(address&&!['127.0.0.1','::ffff:127.0.0.1'].includes(address))return reply(403,{error:'loopback_only'});
  if(!/^127\.0\.0\.1:\d+$/.test(req.headers.host??''))return reply(403,{error:'loopback_only'});
  if(req.headers.origin&&req.headers.origin!=='http://'+req.headers.host)return reply(403,{error:'origin_denied'});
  if(req.headers['sec-fetch-site']==='cross-site')return reply(403,{error:'origin_denied'});
  const url=new URL(req.url,'http://'+req.headers.host);
  if(req.method==='GET'&&url.pathname==='/'){
   res.setHeader('Content-Type','text/html; charset=utf-8');res.end(buildAuditionPage(token));return;
  }
  if(req.headers['x-breeze-audition-token']!==token)return reply(403,{error:'audition_token_required'});
  try{
   if(req.method==='GET'&&url.pathname==='/api/history'){
    const records=[];for(const entry of await readdir(directory,{withFileTypes:true}))if(entry.isDirectory()&&validId(entry.name)){try{records.push(await record(entry.name));}catch{}}
    return reply(200,{records:records.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});
   }
   const audioId=url.pathname.match(/^\/api\/audio\/([a-f0-9]{32})$/)?.[1];
   if(req.method==='GET'&&audioId){
    const result=await read(audioId,'result.json');if(result.status!=='ready')return reply(409,{error:'audio_not_ready'});
    const audio=await readFile(join(directory,audioId,'audio.wav'));validateWav(audio);
    if(digest(audio)!==result.audioDigest)return reply(409,{error:'audio_digest_mismatch'});
    res.setHeader('Content-Type','audio/wav');res.end(audio);return;
   }
   if(req.method!=='POST'||!['/api/generate','/api/review'].includes(url.pathname))return reply(404,{error:'not_found'});
   if(!req.headers['content-type']?.startsWith('application/json'))return reply(415,{error:'json_required'});
   let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>12000)return reply(413,{error:'too_large'});chunks.push(chunk);}
   let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return reply(400,{error:'invalid_request'});}
   if(!input||typeof input!=='object'||Array.isArray(input)||!validId(input.id))return reply(400,{error:'invalid_request'});
   if(url.pathname==='/api/review'){
    if(Object.keys(input).sort().join(',')!=='checks,id,notes,verdict'||!['accepted','rejected'].includes(input.verdict)||typeof input.notes!=='string'||input.notes.length>4000||!input.checks||Object.keys(input.checks).sort().join(',')!==[...axes].sort().join(',')||axes.some(k=>typeof input.checks[k]!=='boolean')||(input.verdict==='accepted'&&axes.some(k=>!input.checks[k])))return reply(400,{error:'invalid_review'});
    const r=await record(input.id);if(r.status!=='ready')return reply(409,{error:'audio_not_ready'});
    const review={verdict:input.verdict,checks:input.checks,notes:input.notes,reviewedAt:new Date().toISOString(),scope:'this-candidate-only'};
    const temporary=join(directory,input.id,randomBytes(8).toString('hex')+'.tmp');await writeFile(temporary,json(review),{mode:0o600});await rename(temporary,join(directory,input.id,'review.json'));
    return reply(200,{id:input.id,review});
   }
   if(!['id,presetId,text','id,text'].includes(Object.keys(input).sort().join(',')))return reply(400,{error:'invalid_request'});
   let prepared;try{prepared=prepareBreezeSpeech(input);}catch(e){return reply(400,{error:e.message});}
   const {preset,fields}=prepared,requestDigest=digest(JSON.stringify([preset.id,input.text]));
   try{
    const old=await read(input.id,'request.json');if(old.requestDigest!==requestDigest)return reply(409,{error:'request_conflict'});
    return reply(200,await record(input.id)); // Never synthesize an existing attempt again.
   }catch(e){if(e.code!=='ENOENT')throw e;}
   if(busy)return reply(409,{error:'audition_busy'});
   busy=true;
   try{
    const target=join(directory,input.id);await mkdir(target,{mode:0o700});
    const request={id:input.id,presetId:preset.id,text:input.text,requestDigest,createdAt:new Date().toISOString(),parameters:{voice_id:fields.voice_id,seed:fields.seed,cfg_scale:fields.cfg_scale,instruction:fields.instruction,rules:preset.rules,model:'Q8_0',backend:'Intel UHD 770 Vulkan',hardwareDeclaration:'owner-baseline-not-probed'},reviewStatus:preset.reviewStatus};
    // Persist the attempt before contacting Breeze. A crash leaves UNKNOWN, no retry.
    await writeFile(join(target,'request.json'),json(request),{flag:'wx',mode:0o600});
    logResult(preset,'generating');let audio;
    try{audio=await synthesize({text:input.text,presetId:preset.id});validateWav(audio);}catch{
     await writeFile(join(target,'result.json'),json({status:'failed-or-unknown'}),{flag:'wx',mode:0o600});logResult(preset,'failed-or-unknown');return reply(502,{id:input.id,status:'failed-or-unknown'});
    }
    await writeFile(join(target,'audio.wav'),audio,{flag:'wx',mode:0o600});
    const result={status:'ready',duration:validateWav(audio).durationSeconds,audioDigest:digest(audio),completedAt:new Date().toISOString(),reviewStatus:'human-review-pending'};
    await writeFile(join(target,'result.json'),json(result),{flag:'wx',mode:0o600});logResult(preset,'ready');return reply(200,await record(input.id));
   }finally{busy=false;}
  }catch{return reply(400,{error:'audition_request_failed'});}
 };
}
