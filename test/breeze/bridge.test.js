import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createBreezeJobStore} from '../../src/breeze/job-store.js';
import {pcm24ToWav16,synthesizeLocalBreeze,BREEZE_DAILY_PRESET,localBreezeEndpoint} from '../../src/breeze/local-adapter.js';
import {runBreezeWorkerOnce} from '../../src/breeze/worker.js';
import {validateWav} from '../../src/contract.js';
import {createPrivateVoiceCollection} from '../../src/private-voice-collection.js';
import {createBreezeTools,buildBreezeSilverUi,BREEZE_RESOURCE} from '../../src/breeze/app-surface.js';
import {JSDOM} from 'jsdom';
const schema=await readFile(new URL('../../db/d1/008_breeze_jobs.sql',import.meta.url),'utf8');
const owner='p'.repeat(43),other='q'.repeat(43),key=Buffer.alloc(32,13);
function pcm(hz=440,seconds=.5){const b=Buffer.alloc(Math.floor(24000*seconds)*2);for(let i=0;i<b.length/2;i++)b.writeInt16LE(Math.round(10000*Math.sin(2*Math.PI*hz*i/24000)),i*2);return b;}
function harness(path=':memory:'){
 const db=new DatabaseSync(path);db.exec(schema);let now=100000,fail=null;
 const client={query:async(sql,args=[])=>{if(fail?.(sql,args))throw Error('injected');return db.prepare(sql).all(...args);}};
 const store=createBreezeJobStore({client,masterKey:key,clock:()=>now});
 return {db,store,client,tick:n=>{now+=n},fail:f=>{fail=f}};
}
const enqueue=h=>h.store.enqueue(owner,{requestKey:'breeze_test_001',text:'哥哥在，我们慢慢来。'});
test('24k PCM really resamples to valid 16k WAV without changing duration/pitch',()=>{
 const wav=pcm24ToWav16(pcm());assert.equal(validateWav(wav).durationSeconds,.5);
 let crossings=0;for(let i=46;i<wav.length;i+=2)if(wav.readInt16LE(i-2)<0&&wav.readInt16LE(i)>=0)crossings++;
 assert.ok(Math.abs(crossings-220)<2);
 const high=pcm24ToWav16(pcm(10000));let energy=0;for(let i=1044;i<high.length-1000;i+=2)energy+=high.readInt16LE(i)**2;
 assert.ok(Math.sqrt(energy/((high.length-2044)/2))<100,'10kHz alias is attenuated');
 assert.throws(()=>pcm24ToWav16(Buffer.alloc(1)));assert.throws(()=>pcm24ToWav16(Buffer.alloc(2880002)));
});
test('only loopback, exact frozen multipart preset, one HTTP request and bounded audio',async()=>{
 for(const value of ['https://127.0.0.1:8080','http://evil.example','http://127.0.0.1:8080/?token=x','http://u:p@127.0.0.1:8080'])assert.throws(()=>localBreezeEndpoint(value));
 let calls=0;
 const wav=await synthesizeLocalBreeze({text:'哥哥在。',fetchImpl:async(url,opts)=>{calls++;assert.equal(url,'http://127.0.0.1:8080/v1/audio/speech');assert.equal(opts.redirect,'error');for(const [k,v] of Object.entries(BREEZE_DAILY_PRESET))assert.equal(opts.body.get(k),v);return new Response(pcm(),{headers:{'content-type':'audio/pcm','x-sample-rate':'24000','x-sample-format':'s16le'}});}});
 assert.equal(calls,1);assert.equal(validateWav(wav).durationSeconds,.5);
 await assert.rejects(synthesizeLocalBreeze({text:'哥哥在。',fetchImpl:async()=>{calls++;return new Response('busy',{status:409});}}),/breeze_busy/);assert.equal(calls,2);
 await assert.rejects(synthesizeLocalBreeze({text:'哥哥在。',fetchImpl:async()=>new Response(pcm(),{headers:{'content-type':'audio/wav'}})}),/contract_mismatch/);
});
test('enqueue idempotency, owner isolation, competing claims and encrypted records',async()=>{
 const h=harness(),a=await enqueue(h),b=await enqueue(h);assert.equal(a.id,b.id);
 await assert.rejects(h.store.enqueue(owner,{requestKey:'breeze_test_001',text:'不同文字。'}),/key_conflict/);
 await assert.rejects(h.store.poll(other,a.id),/not_found/);assert.equal(await h.store.claim(other),null);
 const claims=await Promise.all([h.store.claim(owner),h.store.claim(owner)]);assert.equal(claims.filter(Boolean).length,1);
 const stored=h.db.prepare('SELECT * FROM breeze_jobs').get();assert.ok(!JSON.stringify(stored).includes('哥哥'));
 h.db.close();
});
test('partial upload retry uses existing encrypted chunks, publishes only complete matching audio',async()=>{
 const h=harness(),job=await enqueue(h),claim=await h.store.claim(owner),audio=pcm24ToWav16(pcm(440,4));
 const result={...claim,audioBase64:audio.toString('base64')};let once=false;
 h.fail((sql,args)=>{if(sql.startsWith('INSERT INTO breeze_job_parts')&&args[2]===1&&!once){once=true;return true;}return false;});
 await assert.rejects(h.store.complete(owner,result));assert.equal((await h.store.poll(owner,job.id)).state,'claimed');
 h.fail(null);await h.store.complete(owner,result);await h.store.complete(owner,result);
 const got=await h.store.poll(owner,job.id);assert.equal(got.record.source,'breeze');assert.equal(got.record.audioBase64,result.audioBase64);
 await assert.rejects(h.store.complete(owner,{...result,claimToken:'wrong'}),/denied/);
 await assert.rejects(h.store.complete(owner,{...result,audioBase64:pcm24ToWav16(pcm(880,4)).toString('base64')}),/conflict/);
 await assert.rejects(h.store.poll(other,job.id));h.db.close();
});
test('expired or crashed claims never requeue; stale completion cannot publish',async()=>{
 const h=harness(),job=await enqueue(h),claim=await h.store.claim(owner);h.tick(900001);
 assert.equal((await h.store.poll(owner,job.id)).state,'unknown');assert.equal(await h.store.claim(owner),null);
 await assert.rejects(h.store.complete(owner,{...claim,audioBase64:pcm24ToWav16(pcm()).toString('base64')}),/closed/);
 const h2=harness(),j=await enqueue(h2);h2.tick(1200001);assert.equal((await h2.store.poll(owner,j.id)).state,'expired');assert.equal(await h2.store.claim(owner),null);h.db.close();h2.db.close();
});
test('queue survives process restart and returns original generated bytes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'breeze-db-')),path=join(dir,'state.sqlite');
 try{let h=harness(path),j=await enqueue(h),c=await h.store.claim(owner),audio=pcm24ToWav16(pcm());await h.store.complete(owner,{...c,audioBase64:audio.toString('base64')});h.db.close();h=harness(path);assert.equal((await h.store.poll(owner,j.id)).record.audioBase64,audio.toString('base64'));h.db.close();}finally{await rm(dir,{recursive:true,force:true});}
});
test('worker marks attempt before synthesis, upload failure cannot trigger a second generation',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'breeze-worker-'));let synthesized=0,uploads=0,failures=0;
 const job={id:'voice_'+'a'.repeat(32),claimToken:'c'.repeat(43),text:'哥哥在。'};
 const queue={claim:async()=>job,complete:async()=>{uploads++;throw Error('network_unknown')},fail:async()=>{failures++}};
 try{await assert.rejects(runBreezeWorkerOnce({queue,stateDirectory:dir,synthesize:async()=>{synthesized++;return pcm24ToWav16(pcm())}}),/network_unknown/);
 await assert.rejects(runBreezeWorkerOnce({queue,stateDirectory:dir,synthesize:async()=>{synthesized++}}),/attempt_unknown/);
 assert.equal(synthesized,1);assert.equal(uploads,1);assert.equal(failures,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('full offline queue-worker-result chain calls synth once without paid provider imports',async()=>{
 const h=harness(),j=await enqueue(h),dir=await mkdtemp(join(tmpdir(),'breeze-e2e-'));let count=0;
 try{const queue={claim:()=>h.store.claim(owner),complete:r=>h.store.complete(owner,r),fail:r=>h.store.fail(owner,r)};
 const result=await runBreezeWorkerOnce({queue,stateDirectory:dir,synthesize:async({text})=>{count++;assert.equal(text,'哥哥在，我们慢慢来。');return pcm24ToWav16(pcm())}});
 assert.equal(result.state,'ready');assert.equal((await h.store.poll(owner,j.id)).record.source,'breeze');
 assert.equal((await runBreezeWorkerOnce({queue,stateDirectory:dir})).state,'idle');assert.equal(count,1);
 for(const file of ['job-store.js','worker.js','local-adapter.js']){const s=await readFile(new URL('../../src/breeze/'+file,import.meta.url),'utf8');assert.doesNotMatch(s,/import.*(?:minimax|paid|admission)/i);}
 }finally{h.db.close();await rm(dir,{recursive:true,force:true});}
});
test('Breeze result saves and reloads with truthful provenance, receipt cannot be relabeled MiniMax',async()=>{
 const h=harness();h.db.exec(await readFile(new URL('../../db/d1/007_private_voice_favorites.sql',import.meta.url),'utf8'));
 const collection=createPrivateVoiceCollection({client:h.client,masterKey:key,allowBreeze:true});
 const j=await enqueue(h),c=await h.store.claim(owner);await h.store.complete(owner,{...c,audioBase64:pcm24ToWav16(pcm()).toString('base64')});
 const tools=createBreezeTools({principal:owner,jobs:h.store,collection});
 assert.equal(tools.tools[0]._meta.ui.resourceUri,BREEZE_RESOURCE);assert.deepEqual(tools.tools[1]._meta.ui.visibility,['app']);
 const result=await tools.call('poll_shenshu_local_breeze',{id:j.id});assert.equal(result.structuredContent.state,'ready');assert.ok(!JSON.stringify(result.structuredContent).includes('audioBase64'));
 const record=result._meta.shenshuPrivateAudio.record,receipt=result._meta.shenshuCollection.receipt;
 await assert.rejects(collection.save(owner,{...record,source:'minimax'},receipt));
 await collection.save(owner,record,receipt);assert.equal((await collection.get(owner,j.id)).source,'breeze');
 const legacy=createPrivateVoiceCollection({client:h.client,masterKey:key});assert.throws(()=>legacy.issueReceipt(owner,record));
 assert.equal((await collection.list(owner)).records[0].body,record.text);h.db.close();
});
test('independent silver resource loads real Breeze bytes into existing playback and favorite path',async()=>{
 const dom=new JSDOM(buildBreezeSilverUi({collectionEnabled:true}),{runScripts:'outside-only'}),w=dom.window;
 w.HTMLMediaElement.prototype.pause=function(){};w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};
 const contexts=[];
 w.AudioContext=class{
  constructor(){this.state='running';this.currentTime=0;contexts.push(this);}
  async resume(){} async close(){this.state='closed';}
  async decodeAudioData(bytes){assert.deepEqual(Buffer.from(bytes),audio);return {duration:.5,sampleRate:16000,numberOfChannels:1};}
  createBufferSource(){return this.source={connect(){},disconnect(){},start(){this.started=true},stop(){this.stopped=true}};}
 };
 w.parent.postMessage=()=>{};w.eval(w.document.querySelector('script').textContent);
 assert.equal(w.document.body.classList.contains('desktop04'),true,'Breeze must activate desktop silver styles');
 assert.equal(w.getComputedStyle(w.document.querySelector('.silver-player')).display,'grid');
 assert.equal(w.getComputedStyle(w.document.querySelector('.sender')).display,'none');
 assert.equal(w.getComputedStyle(w.document.getElementById('diagnostics')).display,'none');
 assert.equal(w.getComputedStyle(w.document.getElementById('wave')).height,'24px');
 const audio=pcm24ToWav16(pcm()),record={id:'voice_'+'b'.repeat(32),source:'breeze',generated:true,desktopDirect04:true,text:'哥哥在。',audioMimeType:'audio/wav',audioBase64:audio.toString('base64'),durationSeconds:.5};
 await w.eval('breezePending('+JSON.stringify({structuredContent:{id:record.id,breezePending:true,state:'ready'},_meta:{shenshuPrivateAudio:{record},shenshuCollection:{receipt:{createdAt:'2026-11-11T00:00:00.000Z',signature:'s'}}}})+')');
 assert.equal(w.document.getElementById('play').disabled,false);assert.equal(w.document.getElementById('favorite').disabled,false);assert.equal(w.document.getElementById('text').textContent,record.text);
 assert.match(w.document.getElementById('status').textContent,/本地声音已准备好/);
 assert.equal(contexts.length,0,'ready result must not autoplay');
 w.document.getElementById('play').click();await new Promise(r=>setImmediate(r));
 assert.equal(contexts.length,1,'user click must reach the Breeze Web Audio playback path');
 assert.equal(contexts[0].source.started,true);
 contexts[0].currentTime=.25;w.eval('paint()');
 assert.equal(w.document.getElementById('silver-track').getAttribute('aria-valuenow'),'50');
 w.document.getElementById('play').click();await new Promise(r=>setImmediate(r));
 assert.equal(contexts[0].source.stopped,true);
 const calls=[];
 w.parent.postMessage=msg=>{
  if(msg.method!=='tools/call')return;
  calls.push(msg.params.name);
  assert.equal(msg.params.arguments.id,record.id);
  queueMicrotask(()=>w.dispatchEvent(new w.MessageEvent('message',{source:w.parent,data:{jsonrpc:'2.0',id:msg.id,result:{structuredContent:{id:record.id,breezePending:true,state:'ready'},_meta:{shenshuPrivateAudio:{record}}}}})));
 };
 await w.eval('breezePending('+JSON.stringify({structuredContent:{id:record.id,breezePending:true,state:'ready'}})+')');
 assert.deepEqual(calls,['poll_shenshu_local_breeze'],'reopening reads the existing result only');
 assert.equal(w.document.getElementById('play').disabled,false);
 assert.equal(contexts.length,1,'reopening must not autoplay');
 w.document.getElementById('play').click();await new Promise(r=>setImmediate(r));
 assert.equal(contexts.length,2);assert.equal(contexts[1].source.started,true);
 dom.window.close();
});
