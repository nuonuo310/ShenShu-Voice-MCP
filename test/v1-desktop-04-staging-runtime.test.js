process.env.NODE_ENV='test';
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createD1P2ConfirmationOperationStore} from '../src/d1-p2-confirmation-operation-store.js';
import {createPrivateTextSealer} from '../src/v1-p2-private-text-sealer.js';
import {makeInlineToneFixture} from '../src/inline-fixture.js';
import {createDesktop04D1Factory,assessDesktop04StagingConfig} from '../src/v1-desktop-04-staging-runtime.js';
import {DESKTOP_04_VOICE_ID} from '../src/v1-desktop-direct-04-offline.js';
import {AUTH0_ISSUER,STAGING_RESOURCE_ORIGIN} from '../src/protected-resource-identity.js';
const {createShenShuRuntimeServer}=await import('../server.js');
const PREPARE='prepare_shenshu_desktop_04',CONFIRM='confirm_shenshu_desktop_04';
const audio=Buffer.from(makeInlineToneFixture().audioBase64,'base64');
const owner='o'.repeat(43),other='z'.repeat(43),sha='a'.repeat(40);
const masterKey=Buffer.alloc(32,17);
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'desktop-test',alg:'RS256',use:'sig'};
function env(){return {
 NODE_ENV:'test',SHENSHU_STAGING_RESOURCE_MODE:'1',SHENSHU_STAGING_ORIGIN:STAGING_RESOURCE_ORIGIN,
 SHENSHU_AUTH_MCP_ENABLED:'1',SHENSHU_AUTH_STATIC_JWKS_TEST_ONLY:'1',SHENSHU_AUTH_PUBLIC_JWKS_JSON:JSON.stringify({keys:[jwk]}),
 SHENSHU_PLAYER_ENABLED:'1',SHENSHU_PLAYER_AUTH0_CLIENT_ID:'x'.repeat(32),SHENSHU_PLAYER_SESSION_SECRET:'synthetic-desktop-session-secret-0123456789',
 SHENSHU_NONBILLABLE_PLAYER_ENABLED:'1',SHENSHU_STAGING_SEALED_PLAYER_ENABLED:'1',
 SHENSHU_PRIVATE_TEXT_MASTER_KEY_BASE64:masterKey.toString('base64'),SHENSHU_PRIVATE_FIXTURE_ENABLED:'1',
 SHENSHU_DESKTOP_04_APP_ENABLED:'1',SHENSHU_STAGING_FINAL_WIRING_ENABLED:'1',SHENSHU_STAGING_PAID_CONFIRM_ENABLED:'1',
 SHENSHU_STAGING_REAL_PROVIDER_ENABLED:'1',SHENSHU_STAGING_PRIVATE_AUDIO_ENABLED:'1',SHENSHU_STAGING_APPROVED_SHA:sha,
 SHENSHU_MINIMAX_API_KEY:'test-only-desktop-key',SHENSHU_MINIMAX_VOICE_ID:DESKTOP_04_VOICE_ID,
};}
async function database(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 for(const name of ['001_paid_voice_reservations.sql','002_paid_voice_grants.sql','004_paid_voice_confirmation_operations.sql','005_paid_voice_confirmation_private_text_sealing.sql'])
  db.exec(await readFile(new URL('../db/d1/'+name,import.meta.url),'utf8'));
 return {db,client:{query:async(sql,params=[])=>db.prepare(sql).all(...params)}};
}
async function harness({failure=false}={}){
 const {db,client}=await database();let calls=0,now=Date.now();
 const store=createD1P2ConfirmationOperationStore({client,maximumDailyCalls:1,textSealer:createPrivateTextSealer({masterKey})});
 await store.verifySchema();
 const factory=createDesktop04D1Factory({operationStore:store,clock:()=>now,operationTtlMs:1000,
 resolveVerifiedIdentity:async request=>({verified:true,subject:request.headers.authorization.endsWith('other')?other:owner}),
 synthesize:async()=>{calls++;if(failure)throw Error('upstream');return {audio};},
 });
 const surface=who=>factory({verifiedRequest:{headers:{authorization:'Bearer '+('t'.repeat(30))+(who==='other'?'other':'owner')}}});
 return {db,store,surface,calls:()=>calls,advance:()=>{now+=2000;}};
}
test('desktop defaults and each independent paid gate fail closed before cloud construction',()=>{
 assert.equal(assessDesktop04StagingConfig({}),'desktop04_flag_off');
 const ready=env();assert.equal(assessDesktop04StagingConfig(ready,{currentSha:sha}),'desktop04_ready');
 for(const key of ['SHENSHU_STAGING_FINAL_WIRING_ENABLED','SHENSHU_STAGING_PAID_CONFIRM_ENABLED','SHENSHU_STAGING_REAL_PROVIDER_ENABLED','SHENSHU_STAGING_PRIVATE_AUDIO_ENABLED'])
  assert.notEqual(assessDesktop04StagingConfig({...ready,[key]:'0'},{currentSha:sha}),'desktop04_ready');
 assert.equal(assessDesktop04StagingConfig(ready,{currentSha:'b'.repeat(40)}),'desktop04_sha_mismatch');
 assert.notEqual(assessDesktop04StagingConfig({...ready,SHENSHU_MINIMAX_VOICE_ID:'wrong'},{currentSha:sha}),'desktop04_ready');
 assert.equal(assessDesktop04StagingConfig({...ready,NODE_ENV:'production',RENDER_GIT_COMMIT:sha}),'desktop04_test_injection_forbidden');
});
test('sealed prepare is nonbillable; concurrent confirmation and replay synthesize once; audio is widget-only',async()=>{
 const h=await harness();try{
 const app=h.surface();const p=await app.call(PREPARE,{text:'糯糯，哥哥在。'});
 assert.equal(h.calls(),0);assert.equal(p.structuredContent.billable,false);
 const row=h.db.prepare('SELECT text,sealed_text,max_daily_calls FROM paid_voice_confirmation_operations').get();
 assert.notEqual(row.text,'糯糯，哥哥在。');assert.ok(row.sealed_text);assert.equal(row.max_daily_calls,1);
 const answers=await Promise.allSettled([app.call(CONFIRM,{handle:p.structuredContent.handle}),app.call(CONFIRM,{handle:p.structuredContent.handle})]);
 assert.equal(answers.filter(r=>r.status==='fulfilled').length,1);assert.equal(h.calls(),1);
 const result=answers.find(r=>r.status==='fulfilled').value;
 assert.ok(result._meta.shenshuPrivateAudio.record.audioBase64);
 assert.ok(!JSON.stringify({content:result.content,structuredContent:result.structuredContent}).includes('audioBase64'));
 await assert.rejects(app.call(CONFIRM,{handle:p.structuredContent.handle}));assert.equal(h.calls(),1);
 assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM paid_voice_grants WHERE state=\'consumed\'').get().n,1);
 }finally{h.db.close();}
});
test('wrong owner, changed arguments and expired proposal never invoke provider',async()=>{
 const h=await harness();try{const app=h.surface(),p=await app.call(PREPARE,{text:'短句。'});const handle=p.structuredContent.handle;
 await assert.rejects(h.surface('other').call(CONFIRM,{handle}));
 await assert.rejects(app.call(CONFIRM,{handle,text:'篡改'}));h.advance();
 await assert.rejects(app.call(CONFIRM,{handle}));assert.equal(h.calls(),0);
 }finally{h.db.close();}
});
test('provider uncertainty is durable and cannot be retried even through a newly created surface',async()=>{
 const h=await harness({failure:true});try{const app=h.surface(),p=await app.call(PREPARE,{text:'短句。'});
 await assert.rejects(app.call(CONFIRM,{handle:p.structuredContent.handle}));
 assert.equal(h.db.prepare('SELECT state FROM paid_voice_confirmation_operations').get().state,'unknown');
 await assert.rejects(h.surface().call(CONFIRM,{handle:p.structuredContent.handle}));assert.equal(h.calls(),1);
 }finally{h.db.close();}
});
test('second proposal hits shared daily quota without a second provider attempt',async()=>{
 const h=await harness();try{const app=h.surface();
 const a=await app.call(PREPARE,{text:'一句。'}),b=await app.call(PREPARE,{text:'两句。'});
 await app.call(CONFIRM,{handle:a.structuredContent.handle});await assert.rejects(app.call(CONFIRM,{handle:b.structuredContent.handle}));
 assert.equal(h.calls(),1);
 }finally{h.db.close();}
});
function token(sub='auth0|desktop-owner'){
 const now=Math.floor(Date.now()/1000);
 const head=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT',kid:jwk.kid})).toString('base64url');
 const body=Buffer.from(JSON.stringify({iss:AUTH0_ISSUER,aud:STAGING_RESOURCE_ORIGIN+'/paid-mcp',sub,scope:'voice:speak',iat:now-1,exp:now+300})).toString('base64url');
 const value=head+'.'+body;return value+'.'+sign('RSA-SHA256',Buffer.from(value),privateKey).toString('base64url');
}
test('normal server HTTP mounts desktop tools only behind exact gates, uses real adapter with fake transport, and leaves player confirmation absent',async()=>{
 const {db,client}=await database();let calls=0;
 const runtime=await createShenShuRuntimeServer({env:env(),d1Client:client,currentSha:sha,
 fetchImpl:async(url,options)=>{assert.equal(url,'https://api.minimaxi.com/v1/t2a_v2');calls++;
 const body=JSON.parse(options.body);assert.equal(body.voice_setting.voice_id,DESKTOP_04_VOICE_ID);assert.equal(body.text,'电脑官端测试。');
 return new Response(JSON.stringify({base_resp:{status_code:0},data:{audio:audio.toString('hex')}}),{headers:{'content-type':'application/json'}});},
 });
 assert.equal(runtime.desktop04Mounted,true);assert.equal(runtime.paidConfirmMounted,false);
 await new Promise(resolve=>runtime.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+runtime.server.address().port;
 const bearer=token();
 async function rpc(method,params={},authorization=bearer){
 const r=await fetch(base+'/paid-mcp',{method:'POST',headers:{authorization:'Bearer '+authorization,'content-type':'application/json',accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});return {status:r.status,body:await r.json()};}
 try{
 const list=await rpc('tools/list');assert.ok(list.body.result.tools.some(t=>t.name===PREPARE));
 assert.deepEqual(list.body.result.tools.find(t=>t.name===CONFIRM)._meta.ui.visibility,['app']);
 assert.equal((await rpc('tools/list',{},'bad')).status,401);
 const p=await rpc('tools/call',{name:PREPARE,arguments:{text:'电脑官端测试。'}});assert.equal(calls,0);
 const handle=p.body.result.structuredContent.handle;
 const bad=await rpc('tools/call',{name:CONFIRM,arguments:{handle}},token('auth0|other'));
 assert.ok(bad.body.error||bad.body.result?.isError);assert.equal(calls,0);
 const result=await rpc('tools/call',{name:CONFIRM,arguments:{handle}});
 assert.equal(result.body.result.structuredContent.status,'audio_ready');assert.equal(calls,1);
 assert.ok(result.body.result._meta.shenshuPrivateAudio.record.audioBase64);
 await rpc('tools/call',{name:CONFIRM,arguments:{handle}});assert.equal(calls,1);
 assert.equal((await fetch(base+'/player/confirm')).status,404);
 }finally{await new Promise(resolve=>runtime.server.close(resolve));db.close();}
});

test('failed admission attestation burns the claim and blocks all provider work',async()=>{
 const h=await harness();let calls=0;
 try{
 const factory=createDesktop04D1Factory({operationStore:{...h.store,attestAdmission:async()=>({admitted:false})},
 resolveVerifiedIdentity:async()=>({verified:true,subject:owner}),synthesize:async()=>{calls++;return {audio};}});
 const app=factory({verifiedRequest:{headers:{authorization:'Bearer '+('t'.repeat(30))}}});
 const pending=await app.call(PREPARE,{text:'不应生成。'});
 await assert.rejects(app.call(CONFIRM,{handle:pending.structuredContent.handle}));
 assert.equal(calls,0);assert.equal(h.db.prepare('SELECT state FROM paid_voice_confirmation_operations').get().state,'unknown');
 }finally{h.db.close();}
});
test('disabled desktop composition does not construct a D1 client or provider request',async()=>{
 const {composeDesktop04StagingRuntime}=await import('../src/v1-desktop-04-staging-runtime.js');
 const result=await composeDesktop04StagingRuntime({env:{},createD1Client:()=>{throw Error('must not construct');},fetchImpl:()=>{throw Error('must not fetch');}});
 assert.equal(result.factory,null);assert.equal(result.code,'desktop04_flag_off');
});
