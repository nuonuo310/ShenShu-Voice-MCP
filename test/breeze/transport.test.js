import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {makeStagingMcpServer} from '../../src/staging-authenticated-mcp.js';
import {createBreezeWorkerHandler} from '../../src/breeze/worker-http.js';
import {composeBreezeRuntime} from '../../src/breeze/runtime.js';
import {BREEZE_RESOURCE} from '../../src/breeze/app-surface.js';
const principal='p'.repeat(43);
test('worker HTTP rejects missing auth and injected owner, returns private no-store task only to mapped identity',async()=>{
 let calls=0;const handler=createBreezeWorkerHandler({jobs:{claim:p=>{assert.equal(p,principal);calls++;return {id:'voice_'+'a'.repeat(32),text:'私有文字'};}},resolveWorkerPrincipal:req=>{if(req.headers.authorization!=='Bearer test-only')throw Error();return principal;}});
 const server=createServer(async(req,res)=>{if(!await handler(req,res)){res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+server.address().port+'/breeze/worker/claim';
 try{
  let r=await fetch(url,{method:'POST',body:'{}'});assert.equal(r.status,401);assert.equal(calls,0);
  r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer test-only'},body:JSON.stringify({principal:'attacker'})});assert.equal(r.status,400);assert.equal(calls,0);
  r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer test-only'},body:'{}'});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal((await r.json()).text,'私有文字');assert.equal(calls,1);
 }finally{await new Promise(r=>server.close(r));}
});
test('MCP default off; explicit local tool/resource use owner-scoped queue with no paid factory',async()=>{
 let enqueue=0;
 for(const enabled of [false,true]){
  const server=makeStagingMcpServer({verifiedSubject:principal,privateFixtureEnabled:true,silverUi:true,breezeJobs:enabled?{available:async()=>true,enqueue:async(p,args)=>{assert.equal(p,principal);assert.equal(args.text,'哥哥在。');enqueue++;return {id:'voice_'+'a'.repeat(32),state:'queued'};}}:null});
  const client=new Client({name:'breeze-offline-test',version:'1'}),[a,b]=InMemoryTransport.createLinkedPair();await Promise.all([server.connect(a),client.connect(b)]);
  try{
   const names=(await client.listTools()).tools.map(t=>t.name);assert.equal(names.includes('speak_shenshu_local_breeze'),enabled);assert.equal(names.includes('speak_shenshu_desktop_04'),false);
   if(enabled){const r=await client.callTool({name:'speak_shenshu_local_breeze',arguments:{requestKey:'local_test_001',text:'哥哥在。'}});assert.equal(r.structuredContent.state,'queued');const ui=await client.readResource({uri:BREEZE_RESOURCE});assert.match(ui.contents[0].text,/breezePending/);}
   else await assert.rejects(client.readResource({uri:BREEZE_RESOURCE}));
  }finally{await client.close();await server.close();}
 }
 assert.equal(enqueue,1);
});
test('partial runtime configuration remains absent before any D1 access',async()=>{
 let db=0;const make=()=>{db++;throw Error();};
 assert.equal(await composeBreezeRuntime({env:{},createD1Client:make}),null);
 assert.equal(await composeBreezeRuntime({env:{SHENSHU_BREEZE_ENABLED:'1'},createD1Client:make}),null);assert.equal(db,0);
});
