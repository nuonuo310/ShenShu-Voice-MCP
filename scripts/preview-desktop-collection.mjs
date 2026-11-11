/** LOOPBACK synthetic preview only. Never deploy or reverse-proxy this script. */
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync} from 'node:fs';
import {buildDesktopSilverUi} from '../src/desktop-silver-ui.js';
import {createPrivateVoiceCollection,createCollectionTools} from '../src/private-voice-collection.js';
import {makeInlineToneFixture} from '../src/inline-fixture.js';
const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../db/d1/007_private_voice_favorites.sql',import.meta.url),'utf8'));
const owner='p'.repeat(43),collection=createPrivateVoiceCollection({masterKey:Buffer.alloc(32,17),client:{query:async(sql,params=[])=>db.prepare(sql).all(...params)}});
const tools=createCollectionTools({collection,principal:owner});
const fixture=makeInlineToneFixture();
const record={...fixture,id:'voice_'+('a'.repeat(32)),text:'离线预览 · 非计费提示音，非沈述语音。\n可试播放、收藏，再刷新后打开声音馆。',voiceLabel:'沈述',source:'minimax',generated:true,desktopDirect04:true};
const proof=collection.issueReceipt(owner,record);
const demoMeta={id:record.id,title:'沈述 · 离线预览',body:record.text,createdAt:proof.createdAt,date:proof.createdAt.slice(0,10),duration:record.durationSeconds,captions:[],demo:true};
let html=readFileSync(new URL('../ui/mcp-bubble.html',import.meta.url),'utf8').replace('const isDesktop04Bubble=false;','const isDesktop04Bubble=true;').replace('const isOAuthBubble=window.location.href.includes("private-fixture-bubble-v1");','const isOAuthBubble=true;');
html=buildDesktopSilverUi(html,{collectionEnabled:true});
// The demo simulates its OWN host, including when ChatGPT embeds this HTML in
// an iframe. Never send preview RPC to the real parent window. Production UI
// keeps the authenticated parent transport from mcp-bubble.html unchanged.
html=html.replaceAll('window.parent.postMessage(','window.postMessage(').replaceAll('event.source!==window.parent','event.source!==window');
html=html.replace('<script type="module">',`<script>window.postMessage=async function(msg){if(!msg.id)return;let result;if(msg.method==='ui/initialize')result={};else if(msg.method==='tools/call'){try{result=await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(msg.params)}).then(r=>r.json());}catch{result={isError:true};}}window.dispatchEvent(new MessageEvent('message',{source:window,data:{jsonrpc:'2.0',id:msg.id,result}}));};</script><script type="module">`);
html=html.replace('</script>\n</body>',`\napplyResponse({structuredContent:{record:${JSON.stringify(record)}}});desktopCollection.receive(record,{receipt:${JSON.stringify(proof)},saved:false});\n</script>\n</body>`);
// A visible label ensures this cannot be mistaken for a new real 04 trial.
html=html.replace('<div class="shell">','<div class="shell"><p id="preview-note" style="font-size:11px;color:#858a92;margin:0 0 20px">离线播放器预览 · 合成提示音 · 不调用 MiniMax</p>');
// Export is a self-contained visual demo. Its localStorage adapter is ONLY a
// synthetic host mock; production favorites always use authenticated encrypted D1.
if(process.argv[2]==='--export'){
 const host=`<script>(()=>{let memory=false,storage=null;const key='shenshu:silver-preview-only';function limited(){storage=null;document.getElementById('preview-note').textContent='离线外观与交互预览 · 合成提示音，非 04 · 当前环境禁止本机存储，收藏仅本次演示';}try{storage=localStorage;memory=storage.getItem(key)==='1';}catch{limited();}window.postMessage=async function(msg){if(!msg.id)return;let result={};try{if(msg.method==='tools/call'){const q=msg.params,n=q.name;const saved=memory;if(n==='save_shenshu_voice_favorite'){memory=true;try{storage?.setItem(key,'1');}catch{limited();}result={structuredContent:{saved:true}};}else if(n==='remove_shenshu_voice_favorite'){memory=false;try{storage?.removeItem(key);}catch{limited();}result={structuredContent:{removed:true}};}else if(n==='list_shenshu_voice_favorites'){result={_meta:{shenshuCollectionPage:{records:saved?[${JSON.stringify(demoMeta)}]:[],cursor:null}}};}else if(n==='get_shenshu_voice_favorite'&&saved){result={_meta:{shenshuPrivateAudio:{record:${JSON.stringify(record)}},shenshuCollection:{saved:true,receipt:${JSON.stringify(proof)}}}};}else result={isError:true};}}catch{result={isError:true};}window.dispatchEvent(new MessageEvent('message',{source:window,data:{jsonrpc:'2.0',id:msg.id,result}}));};})();</script>`;
 html=html.replace(/<script>window\.postMessage=[\s\S]*?<\/script>/,()=>host);
 html=html.replace('离线播放器预览 · 合成提示音 · 不调用 MiniMax','离线外观与交互预览 · 合成提示音，非 04 · 收藏仅为本机演示');
 writeFileSync(process.argv[3]||'preview/offline-player.html',html);db.close();
}else{
const server=createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method==='GET'&&req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
 if(req.method==='POST'&&req.url==='/rpc'&&req.headers.origin===`http://127.0.0.1:${server.address().port}`){
  try{let data='';for await(const chunk of req){data+=chunk;if(data.length>3_000_000)throw Error();}const q=JSON.parse(data);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await tools.call(q.name,q.arguments)));}catch{res.statusCode=400;res.end('{}');}return;
 }
 res.statusCode=404;res.end();
});
server.listen(Number(process.env.PREVIEW_PORT||3188),'127.0.0.1',()=>console.log('SYNTHETIC PREVIEW http://127.0.0.1:'+server.address().port));
}
