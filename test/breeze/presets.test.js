import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {JSDOM} from 'jsdom';
import {BREEZE_PRESETS,prepareBreezeSpeech,resolveBreezePreset} from '../../src/breeze/presets.js';
import {BREEZE_AUDITION_CANDIDATES} from '../../src/breeze/audition-candidates.js';
import {synthesizeLocalBreeze,pcm24ToWav16,BREEZE_DAILY_PRESET} from '../../src/breeze/local-adapter.js';
import {createBreezeAuditionHandler} from '../../src/breeze/audition-server.js';
import {createBreezeTools} from '../../src/breeze/app-surface.js';
import {buildAuditionPage} from '../../src/breeze/audition-ui.js';
const id='a'.repeat(32),text=BREEZE_AUDITION_CANDIDATES[0].text;
const pcm=Buffer.alloc(24000),wav=pcm24ToWav16(pcm);
async function call(handler,path,{method='GET',token,body,headers={}}={}){
 const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);Object.assign(req,{url:path,method,headers:{host:'127.0.0.1:8082',...(token?{'x-breeze-audition-token':token}:{}),...(body?{'content-type':'application/json'}:{}),...headers},socket:{localAddress:'127.0.0.1'}});
 let output;const responseHeaders={};const res={statusCode:200,setHeader(k,v){responseHeaders[k]=v},end(b){output=b}};
 await handler(req,res);return {status:res.statusCode,headers:responseHeaders,raw:output,data:responseHeaders['Content-Type']?.startsWith('application/json')?JSON.parse(output):undefined};
}
async function setup(synthesize=async()=>wav){const directory=await mkdtemp(join(tmpdir(),'breeze-audition-test-')),logs=[];const handler=await createBreezeAuditionHandler({directory,synthesize,log:value=>logs.push(value)});const page=await call(handler,'/');const token=page.raw.match(/const auditionToken="([a-f0-9]+)"/)[1];return {directory,handler,token,logs,close:()=>rm(directory,{recursive:true,force:true})};}
test('only three immutable presets; default daily fields are byte-for-byte baseline',()=>{
 assert.deepEqual(Object.keys(BREEZE_PRESETS),['daily','kiss','breath']);
 assert.equal(resolveBreezePreset().id,'daily');for(const value of ['',null,2,'firm','toString','__proto__'])assert.throws(()=>resolveBreezePreset(value),/unknown_preset/);
 const {fields}=prepareBreezeSpeech({text:'哥哥在。'});assert.deepEqual(fields,{...BREEZE_DAILY_PRESET,text:'哥哥在。'});
 assert.equal(fields.seed,'7');assert.equal(fields.cfg_scale,'1.2');assert.equal(fields.instruction,'自然、清晰、有温度的日常对话。语气放松亲近，使用平常说话的节奏，不要朗诵。');
 assert.notEqual(BREEZE_PRESETS.kiss.instruction,BREEZE_PRESETS.breath.instruction);
 assert.notDeepEqual(BREEZE_PRESETS.kiss.rules,BREEZE_PRESETS.breath.rules);assert.ok(Object.isFrozen(BREEZE_PRESETS.kiss.rules));
});
test('event rules reject missing, trailing, leading, duplicate or mixed tags and narration',()=>{
 for(const candidate of BREEZE_AUDITION_CANDIDATES){const p=prepareBreezeSpeech(candidate);assert.equal(p.fields.cfg_scale,'2.0');assert.equal(p.fields.seed,'7');assert.equal(p.fields.voice_id,'shenshu_04_natural');}
 for(const [presetId,text] of [['kiss','过来。'],['kiss','亲一下。[亲吻]'],['kiss','[亲吻]过来。'],['kiss','亲一下。[亲吻][亲吻]好了。'],['kiss','亲一下。[亲吻]好了。[喘息]'],['kiss','亲一下。[亲吻]播放亲吻音效。'],['kiss','走过来。[亲吻]好了。'],['breath','刚走回来。[喘息]……'],['breath','[喘息]先休息。'],['breath','爱爱，走过来。[喘息]休息吧。'],['breath','刚走回来。[喘息]好了。[笑]']])assert.throws(()=>prepareBreezeSpeech({presetId,text}));
 // Old daily calls, including previously submitted tags, remain unchanged.
 assert.equal(prepareBreezeSpeech({text:'亲一下。[亲吻]'}).fields.text,'亲一下。[亲吻]');
});
test('adapter sends distinct event instructions and exact parameters once, invalid preset never fetches',async()=>{
 let calls=0;for(const candidate of BREEZE_AUDITION_CANDIDATES){await synthesizeLocalBreeze({...candidate,fetchImpl:async(url,opts)=>{calls++;assert.equal(opts.body.get('cfg_scale'),'2.0');assert.equal(opts.body.get('instruction'),BREEZE_PRESETS[candidate.presetId].instruction);assert.equal(opts.body.get('text'),candidate.text);assert.equal(opts.body.get('seed'),'7');return new Response(pcm,{headers:{'content-type':'audio/pcm','x-sample-rate':'24000','x-sample-format':'s16le'}});}});}
 await assert.rejects(synthesizeLocalBreeze({presetId:'firm',text:'哥哥在。',fetchImpl:()=>{calls++;throw Error()}}),/unknown_preset/);assert.equal(calls,6);
});
test('manual localhost handler rejects cross-origin/host/unauthenticated and invalid preset before generation',async()=>{
 let count=0;const h=await setup(async()=>{count++;return wav});try{
 assert.equal((await call(h.handler,'/',{headers:{host:'evil.example:8082'}})).status,403);
 assert.equal((await call(h.handler,'/',{headers:{origin:'https://evil.example'}})).status,403);
 assert.equal((await call(h.handler,'/api/history')).status,403);
 assert.equal((await call(h.handler,'/api/generate',{method:'POST',token:h.token,body:{id,presetId:'firm',text}})).status,400);
 assert.equal((await call(h.handler,'/api/generate',{method:'POST',token:h.token,body:{id,presetId:'kiss',text},headers:{'sec-fetch-site':'cross-site'}})).status,403);assert.equal(count,0);
 }finally{await h.close();}
});
test('manual generate, durable audio, replay, conflict, review and restart never regenerate',async()=>{
 let count=0;const h=await setup(async args=>{count++;assert.equal(args.presetId,'kiss');return wav});try{
 const request={method:'POST',token:h.token,body:{id,presetId:'kiss',text}};
 const generated=await call(h.handler,'/api/generate',request);assert.equal(generated.status,200);assert.equal(generated.data.status,'ready');assert.equal(generated.data.reviewStatus,'human-review-pending');
 const requestFile=JSON.parse(await readFile(join(h.directory,id,'request.json'),'utf8'));assert.equal(requestFile.text,text);assert.equal(requestFile.parameters.cfg_scale,'2.0');
 assert.deepEqual((await call(h.handler,'/api/audio/'+id,{token:h.token})).raw,wav);
 await call(h.handler,'/api/generate',request);assert.equal(count,1);
 assert.equal((await call(h.handler,'/api/generate',{...request,body:{id,presetId:'daily',text}})).status,409);
 const checks={voice:true,natural:true,integrated:true,clear:true,noNarrationOrTrailingEvent:true};
 assert.equal((await call(h.handler,'/api/review',{method:'POST',token:h.token,body:{id,checks:{...checks,voice:false},verdict:'accepted',notes:''}})).status,400);
 assert.equal((await call(h.handler,'/api/review',{method:'POST',token:h.token,body:{id,checks,verdict:'accepted',notes:'本人试听'}})).status,200);
 const records=(await call(h.handler,'/api/history',{token:h.token})).data.records;assert.equal(records[0].review.scope,'this-candidate-only');
 const restarted=await createBreezeAuditionHandler({directory:h.directory,synthesize:async()=>{count++;return wav}});const page=await call(restarted,'/'),token=page.raw.match(/const auditionToken="([a-f0-9]+)"/)[1];
 assert.equal((await call(restarted,'/api/generate',{...request,token})).data.status,'ready');assert.equal(count,1);
 for(const log of h.logs)assert.deepEqual(Object.keys(log),['presetId','seed','cfg','status']);assert.ok(!JSON.stringify(h.logs).includes(text));
 }finally{await h.close();}
});
test('failed and ambiguous attempts are retained; busy request does not start another synthesis',async()=>{
 let release,count=0;const h=await setup(async()=>{count++;await new Promise(r=>release=r);throw Error('PRIVATE_TEXT_SHOULD_NOT_LOG')});try{
 const request={method:'POST',token:h.token,body:{id,presetId:'kiss',text}};
 const pending=call(h.handler,'/api/generate',request);while(!release)await new Promise(r=>setImmediate(r));
 const second=await call(h.handler,'/api/generate',{...request,body:{...request.body,id:'b'.repeat(32)}});assert.equal(second.status,409);
 const ambiguous=await call(h.handler,'/api/generate',request);assert.equal(ambiguous.data.status,'unknown');assert.equal(count,1);
 release();assert.equal((await pending).status,502);assert.equal((await call(h.handler,'/api/generate',request)).data.status,'failed-or-unknown');assert.equal(count,1);
 assert.ok(!JSON.stringify(h.logs).includes('PRIVATE_TEXT'));assert.deepEqual(await readdir(h.directory),[id]);
 }finally{await h.close();}
});
test('chat tool and worker surface remain daily-only; manual page offers exactly three choices with no auto-generation',async()=>{
 const tools=createBreezeTools({principal:'p'.repeat(43),jobs:{}});assert.equal(tools.tools[0].inputSchema.properties.presetId,undefined);
 await assert.rejects(tools.call('speak_shenshu_local_breeze',{requestKey:'test_1234',text:'哥哥在。',presetId:'kiss'}),/invalid_arguments/);
 const dom=new JSDOM(buildAuditionPage('test-token'),{runScripts:'outside-only',url:'http://127.0.0.1:8082'}),w=dom.window;let generations=0,played=0;
 w.HTMLMediaElement.prototype.pause=function(){};w.HTMLMediaElement.prototype.load=function(){};w.HTMLMediaElement.prototype.play=async()=>{played++};w.URL.createObjectURL=()=> 'blob:local';w.URL.revokeObjectURL=()=>{};
 w.fetch=async(path,options)=>{if(path==='/api/history')return {ok:true,json:async()=>({records:[]})};if(path.startsWith('/api/audio/'))return {ok:true,blob:async()=>new Blob([wav])};if(path==='/api/generate'){generations++;const args=JSON.parse(options.body);return {ok:true,json:async()=>({...args,status:'ready',duration:.5})};}throw Error('unexpected');};
 w.eval(w.document.querySelector('script').textContent);await new Promise(r=>setImmediate(r));assert.equal(generations,0);
 assert.deepEqual([...w.document.querySelectorAll('#preset option')].map(el=>el.value),['daily','kiss','breath']);
 assert.equal(w.document.querySelectorAll('#candidates button').length,6);w.document.querySelector('#candidates button').click();assert.equal(generations,0);
 w.document.getElementById('generate').click();await new Promise(r=>setImmediate(r));assert.equal(generations,1);assert.equal(played,0);assert.equal(w.document.getElementById('play').disabled,false);
 w.document.getElementById('play').click();await new Promise(r=>setImmediate(r));assert.equal(played,1);assert.equal(generations,1);
 dom.window.close();
});
