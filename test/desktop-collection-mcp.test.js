import test from 'node:test';import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';import {readFile} from 'node:fs/promises';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {makeStagingMcpServer} from '../src/staging-authenticated-mcp.js';
import {createPrivateVoiceCollection,COLLECTION_RESOURCE} from '../src/private-voice-collection.js';
import {makeInlineToneFixture} from '../src/inline-fixture.js';
const owner='p'.repeat(43);
async function setup({receiptFailure=false,silverUi=true}={}){
 const db=new DatabaseSync(':memory:');db.exec(await readFile(new URL('../db/d1/007_private_voice_favorites.sql',import.meta.url),'utf8'));
 const store=createPrivateVoiceCollection({masterKey:Buffer.alloc(32,17),client:{query:async(s,p=[])=>db.prepare(s).all(...p)}});
 let providerCalls=0;const audio={...makeInlineToneFixture(),id:'voice_'+('a'.repeat(32)),text:'这是已生成的完整文字。',source:'minimax',generated:true,desktopDirect04:true};
 const names=['prepare_shenshu_desktop_04','confirm_shenshu_desktop_04','probe_shenshu_desktop_04_capacity','speak_shenshu_desktop_04'];
 const desktop04Tools={tools:names.map((name,i)=>({name,inputSchema:{type:'object'},_meta:{ui:{visibility:i===1||i===2?['app']:['model','app'],...(i===0||i===3?{resourceUri:'ui://shenshu/desktop-04-bubble-v1.html'}:{})}}})),async call(){providerCalls++;return {content:[{type:'text',text:'audio ready'}],structuredContent:{status:'audio_ready'},_meta:{shenshuPrivateAudio:{record:audio}}};}};
 const server=makeStagingMcpServer({verifiedSubject:owner,privateFixtureEnabled:true,desktop04Tools,silverUi,voiceCollection:receiptFailure?{...store,issueReceipt(){throw Error('failed')}}:store});
 const client=new Client({name:'collection-test',version:'1'}),[a,b]=InMemoryTransport.createLinkedPair();await Promise.all([server.connect(a),client.connect(b)]);
 return {client,store,audio,calls:()=>providerCalls,async close(){await client.close();await server.close();db.close();}};
}
test('receipt attached after original success; collection failures cannot invoke generator; private saved audio reuses same player',async()=>{
 const h=await setup();try{
 const generated=await h.client.callTool({name:'confirm_shenshu_desktop_04',arguments:{handle:'h'.repeat(43)}});assert.equal(h.calls(),1);
 const receipt=generated._meta.shenshuCollection.receipt;const saved=await h.client.callTool({name:'save_shenshu_voice_favorite',arguments:{record:h.audio,receipt}});assert.equal(saved.structuredContent.saved,true);
 const view=await h.client.callTool({name:'open_shenshu_voice_gallery',arguments:{}});assert.equal(view._meta.shenshuCollectionPage.records.length,1);
 const loaded=await h.client.callTool({name:'get_shenshu_voice_favorite',arguments:{id:h.audio.id}});assert.equal(loaded._meta.shenshuPrivateAudio.record.audioBase64,h.audio.audioBase64);
 await h.client.callTool({name:'save_shenshu_voice_favorite',arguments:{record:{...h.audio,text:'forged'},receipt}});assert.equal(h.calls(),1);
 const resource=await h.client.readResource({uri:COLLECTION_RESOURCE});assert.match(resource.contents[0].text,/silver-player/);assert.match(resource.contents[0].text,/for Nuonuo/);
 }finally{await h.close()}
});
test('prepare, speak and gallery select the same new silver resource; cached legacy resource remains gold; rollback rejects silver',async()=>{
 let h=await setup();try{
 const listed=await h.client.listTools();
 for(const name of ['prepare_shenshu_desktop_04','speak_shenshu_desktop_04','open_shenshu_voice_gallery'])assert.equal(listed.tools.find(t=>t.name===name)._meta.ui.resourceUri,COLLECTION_RESOURCE);
 const resources=await h.client.listResources();assert.ok(resources.resources.some(r=>r.uri===COLLECTION_RESOURCE));
 const old=await h.client.readResource({uri:'ui://shenshu/desktop-04-bubble-v1.html'});assert.ok(!old.contents[0].text.includes('silver-player'));
 const silver=await h.client.readResource({uri:COLLECTION_RESOURCE});assert.match(silver.contents[0].text,/desktopCollection.receive\(next,response\?\._meta\?\.shenshuCollection\)/);assert.equal(h.calls(),0);
 }finally{await h.close()}
 h=await setup({silverUi:false});try{
 const listed=await h.client.listTools();assert.equal(listed.tools.find(t=>t.name==='speak_shenshu_desktop_04')._meta.ui.resourceUri,'ui://shenshu/desktop-04-bubble-v1.html');
 await assert.rejects(h.client.readResource({uri:COLLECTION_RESOURCE}));assert.equal(h.calls(),0);
 }finally{await h.close()}
});
test('receipt failure leaves original audio result intact and charged path called once',async()=>{
 const h=await setup({receiptFailure:true});try{const r=await h.client.callTool({name:'confirm_shenshu_desktop_04',arguments:{}});assert.equal(r.structuredContent.status,'audio_ready');assert.equal(r._meta.shenshuPrivateAudio.record.audioBase64,h.audio.audioBase64);assert.equal(r._meta.shenshuCollection,undefined);assert.equal(h.calls(),1);}finally{await h.close()}
});
test('silver UI rollback removes collection tools and receipts without changing original player or generation',async()=>{
 const h=await setup({silverUi:false});try{
 const listed=await h.client.listTools();assert.ok(!listed.tools.some(t=>t.name.includes('favorite')||t.name==='open_shenshu_voice_gallery'));
 const ui=await h.client.readResource({uri:'ui://shenshu/desktop-04-bubble-v1.html'});assert.ok(!ui.contents[0].text.includes('silver-player'));
 const result=await h.client.callTool({name:'confirm_shenshu_desktop_04',arguments:{}});assert.equal(result._meta.shenshuCollection,undefined);assert.equal(result._meta.shenshuPrivateAudio.record.audioBase64,h.audio.audioBase64);assert.equal(h.calls(),1);
 }finally{await h.close()}
});
