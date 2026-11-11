import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createPrivateVoiceCollection,createCollectionTools} from '../src/private-voice-collection.js';
import {composeDesktopCollection} from '../src/desktop-collection-runtime.js';
import {makeInlineToneFixture} from '../src/inline-fixture.js';
const p='p'.repeat(43),other='q'.repeat(43),key=Buffer.alloc(32,17),now=Date.parse('2026-11-11T12:00:00.000Z');
const fixture=makeInlineToneFixture();
function record(id='voice_'+('a'.repeat(32))){return {id,text:'糯糯，哥哥在。\n完整文字保留。',source:'minimax',generated:true,desktopDirect04:true,audioMimeType:'audio/wav',audioBase64:fixture.audioBase64,durationSeconds:fixture.durationSeconds};}
const schema=await readFile(new URL('../db/d1/007_private_voice_favorites.sql',import.meta.url),'utf8');
function harness(db=new DatabaseSync(':memory:')){db.exec(schema);let failAt=null,calls=0;
 const client={async query(sql,params=[]){calls++;if(failAt?.(sql))throw Error('database_failure');return db.prepare(sql).all(...params);}};
 const make=()=>createPrivateVoiceCollection({client,masterKey:key,clock:()=>now});return {db,client,make,store:make(),fail(fn){failAt=fn},calls:()=>calls};}
test('save is explicit, signed, durable across reopened DB and stores compatible complete metadata/audio',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'voice-favorites-')),path=join(dir,'test.sqlite');
 try{let h=harness(new DatabaseSync(path));const r=record(),receipt=h.store.issueReceipt(p,r);
 assert.equal((await h.store.list(p)).records.length,0);
 const saved=await h.store.save(p,r,receipt);assert.equal(saved.body,r.text);assert.equal(saved.createdAt,'2026-11-11T12:00:00.000Z');
 h.db.close();h=harness(new DatabaseSync(path));const got=await h.store.get(p,r.id);assert.equal(got.audioBase64,r.audioBase64);assert.equal(got.text,r.text);
 assert.equal((await h.store.list(p)).records.length,1);h.db.close();
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('another owner cannot list/read/remove or replay a receipt for the original owner',async()=>{
 const h=harness(),r=record(),receipt=h.store.issueReceipt(p,r);await h.store.save(p,r,receipt);
 assert.deepEqual((await h.store.list(other)).records,[]);await assert.rejects(h.store.get(other,r.id));
 await assert.rejects(h.store.save(other,r,receipt));await h.store.remove(other,r.id);assert.equal((await h.store.get(p,r.id)).text,r.text);h.db.close();
});
test('forged text, id, audio, timestamp, signature and malformed input are refused',async()=>{
 const h=harness(),r=record(),receipt=h.store.issueReceipt(p,r);
 for(const changed of [{...r,text:'篡改'},{...r,id:'voice_'+('b'.repeat(32))},{...r,audioBase64:r.audioBase64.slice(0,-4)+'AAAA'}])await assert.rejects(h.store.save(p,changed,receipt));
 await assert.rejects(h.store.save(p,r,{...receipt,createdAt:'2026-11-12T12:00:00.000Z'}));await assert.rejects(h.store.save(p,r,{...receipt,signature:'x'.repeat(43)}));
 await assert.rejects(h.store.save(p,{...r,audioBase64:'a'.repeat(3_000_000)},receipt));assert.throws(()=>h.store.issueReceipt(p,{...r,generated:false}));h.db.close();
});
test('parallel and retried saves keep one stable ID; cancel removes audio parts; re-save preserves original generated time',async()=>{
 const h=harness(),r=record(),receipt=h.store.issueReceipt(p,r);
 await Promise.all([h.store.save(p,r,receipt),h.store.save(p,r,receipt)]);
 await h.make().save(p,r,receipt);assert.equal((await h.store.list(p)).records.length,1);
 const again=await h.store.get(p,r.id),proof=h.store.issueReceipt(p,again);assert.equal(proof.createdAt,receipt.createdAt);
 await h.store.remove(p,r.id);assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM voice_favorite_parts').get().n,0);await assert.rejects(h.store.get(p,r.id));
 await h.store.save(p,again,proof);assert.equal((await h.store.list(p)).records[0].createdAt,receipt.createdAt);h.db.close();
});
test('interrupted staging never publishes partial audio, retry can recover without synthesis',async()=>{
 const h=harness(),r=record(),proof=h.store.issueReceipt(p,r);h.fail(sql=>sql.startsWith('INSERT INTO voice_favorites('));await assert.rejects(h.store.save(p,r,proof));assert.equal((await h.store.list(p)).records.length,0);
 h.fail(null);await h.store.save(p,r,proof);assert.equal((await h.store.get(p,r.id)).audioBase64,r.audioBase64);h.db.close();
});
test('ciphertext at rest contains no original text or audio; tampered audio/metadata fail closed',async()=>{
 const h=harness(),r=record();await h.store.save(p,r,h.store.issueReceipt(p,r));
 const rows=h.db.prepare('SELECT * FROM voice_favorites').all(),parts=h.db.prepare('SELECT * FROM voice_favorite_parts').all();const dump=JSON.stringify([rows,parts]);assert.ok(!dump.includes(r.text));assert.ok(!dump.includes(r.audioBase64));
 h.db.exec("UPDATE voice_favorite_parts SET payload='AAAA'");await assert.rejects(h.store.get(p,r.id));
 h.db.exec("UPDATE voice_favorites SET sealed_metadata='AAAA'");await assert.rejects(h.store.list(p));h.db.close();
});
test('maximum WAV is encrypted and read in bounded parts through actual D1 response cap',async()=>{
 const h=harness();const query=h.client.query;let maxReply=0;h.client.query=async(...args)=>{const rows=await query(...args);const n=Buffer.byteLength(JSON.stringify({success:true,result:[{success:true,results:rows}]}));maxReply=Math.max(maxReply,n);assert.ok(n<262144);return rows;};
 const bytes=randomBytes(44+60*32000),header=Buffer.from(fixture.audioBase64,'base64').subarray(0,44);header.copy(bytes);bytes.writeUInt32LE(bytes.length-8,4);bytes.writeUInt32LE(bytes.length-44,40);
 const r={...record(),durationSeconds:60,audioBase64:bytes.toString('base64')};await h.store.save(p,r,h.store.issueReceipt(p,r));assert.equal((await h.store.get(p,r.id)).audioBase64,r.audioBase64);
 assert.ok(maxReply>128000);h.db.close();
});
test('pagination has no duplicates for identical generation timestamps',async()=>{
 const h=harness();for(let i=0;i<13;i++){const r=record('voice_'+i.toString(16).padStart(32,'0'));await h.store.save(p,r,h.store.issueReceipt(p,r));}
 const one=await h.store.list(p),two=await h.store.list(p,one.cursor);assert.equal(one.records.length,10);assert.equal(two.records.length,3);assert.equal(new Set([...one.records,...two.records].map(x=>x.id)).size,13);h.db.close();
});
test('tools hide complete text and audio in private meta, mutations app-only, errors contain no details',async()=>{
 const h=harness(),r=record();await h.store.save(p,r,h.store.issueReceipt(p,r));const tools=createCollectionTools({collection:h.store,principal:p});
 for(const t of tools.tools.filter(t=>t.name!=='open_shenshu_voice_gallery'))assert.deepEqual(t._meta.ui.visibility,['app']);
 const page=await tools.call('open_shenshu_voice_gallery',{});assert.equal(page._meta.shenshuCollectionPage.records[0].body,r.text);assert.ok(!JSON.stringify([page.content,page.structuredContent]).includes(r.text));
 const audio=await tools.call('get_shenshu_voice_favorite',{id:r.id});assert.equal(audio._meta.shenshuPrivateAudio.record.audioBase64,r.audioBase64);assert.ok(!JSON.stringify([audio.content,audio.structuredContent]).includes(r.audioBase64));
 await assert.rejects(tools.call('get_shenshu_voice_favorite',{id:r.id,principal:other}));h.fail(()=>true);const bad=await tools.call('list_shenshu_voice_favorites',{cursor:null});assert.equal(bad.isError,true);assert.ok(!JSON.stringify(bad).includes('database_failure'));h.db.close();
});
test('collection defaults off and missing schema/key fails independently',async()=>{
 assert.equal(await composeDesktopCollection({env:{},identityVerifier:()=>{},createD1Client:()=>{throw Error('no')}}),null);
 assert.equal(await composeDesktopCollection({env:{SHENSHU_VOICE_COLLECTION_ENABLED:'1'},identityVerifier:()=>{},createD1Client:()=>{throw Error('no')}}),null);
 const h=harness();assert.equal(await h.store.verifySchema(),true);h.db.close();
});
