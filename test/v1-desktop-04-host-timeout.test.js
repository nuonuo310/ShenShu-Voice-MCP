import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
test('host silence times out one RPC, drops a late response, and never retries',async()=>{
 const html=await readFile(new URL('../ui/mcp-bubble.html',import.meta.url),'utf8');
 const a=html.indexOf('function request('),b=html.indexOf('(async()=>{',a);
 let expire,listener,sends=0,clears=0;
 const parent={postMessage(){sends++;}};
 const ctx=runInNewContext('let rpcId=0;const pending=new Map();'+html.slice(a,b)+';({request,pending})',{
  Promise,window:{parent,addEventListener:(_,cb)=>{listener=cb;}},
  setTimeout:(cb,ms)=>{assert.equal(ms,90000);expire=cb;return 1;},
  clearTimeout:()=>{clears++;},handleDesktop04Pending:()=>false,applyResponse:()=>{},
 });
 const result=ctx.request('tools/call',{name:'confirm_shenshu_desktop_04',arguments:{handle:'synthetic'}});
 const rejected=assert.rejects(result,e=>e.code===-32001);expire();await rejected;
 assert.equal(ctx.pending.size,0);assert.equal(sends,1);
 listener({source:parent,data:{jsonrpc:'2.0',id:1,result:{late:true}}});
 assert.equal(ctx.pending.size,0);assert.equal(sends,1);
 const next=ctx.request('tools/call',{name:'probe_oauth_ui_bridge',arguments:{}});
 listener({source:parent,data:{jsonrpc:'2.0',id:2,result:{ok:true}}});
 assert.equal((await next).ok,true);assert.equal(clears,1);assert.equal(ctx.pending.size,0);
});
