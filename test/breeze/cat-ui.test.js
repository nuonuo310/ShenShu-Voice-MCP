import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {buildBreezeSilverUi,BREEZE_RESOURCE} from '../../src/breeze/app-surface.js';
import {buildDesktopSilverUi} from '../../src/desktop-silver-ui.js';
import {pcm24ToWav16} from '../../src/breeze/local-adapter.js';
const root=new URL('../../',import.meta.url);
test('Breeze compact face has no visible timeline, self-contained art and separate cache resource',()=>{
 assert.equal(BREEZE_RESOURCE,'ui://shenshu/breeze-cat-v3.html');
 const dom=new JSDOM(buildBreezeSilverUi());const d=dom.window.document;
 assert.ok(d.body.classList.contains('breeze-cat'));
 assert.equal(d.querySelector('.portrait'),null);
 assert.equal(d.querySelector('.screen-heading'),null);
 assert.ok(d.getElementById('silver-track').closest('[hidden]'));
 assert.equal(d.querySelector('.cat-companion svg').getAttribute('viewBox'),'0 0 120 112');
 assert.equal(d.getElementById('gallery-open').disabled,true);
 assert.equal(d.querySelectorAll('img[src^="http"],script[src],link[rel="stylesheet"]').length,0);
 const ids=[...d.querySelectorAll('[id]')].map(e=>e.id);assert.equal(new Set(ids).size,ids.length);
 dom.window.close();
});
test('MiniMax silver renderer and its three inputs remain identical to approved parent bytes',()=>{
 // SHA-256 values pinned to approved parent afbdfcae; works in shallow CI clones.
 const baseline={'src/desktop-silver-ui.js': '494d11868f92e13f1e12275859f4d37b46c81297b6d5d6d01f945d259b1d68b8', 'ui/mcp-bubble.html': '69319a1e4c579790428ae4cfdb52ebfd6184ec17bc7e5c101c626801fe47ffb7', 'ui/desktop-silver.css': 'c3e609282365361a9628781112b5813d4a1e09e3ef0dbe722655264f74c1f696', 'ui/desktop-collection.js': '4efc8ef3690e061d3a74d824da8e5e650cc2e6f3fb08d22e1e13d4c7bacbd43d', 'ui/assets/shen-avatar.jpeg': 'b8a33b5d07f76a4111505371015450182f2cb2a0ccd1248017bc2e2397eac191'};
 for(const [p,hash] of Object.entries(baseline))assert.equal(createHash('sha256').update(readFileSync(new URL(p,root))).digest('hex'),hash,p);
 const base=readFileSync(new URL('ui/mcp-bubble.html',root),'utf8');
 const silver=buildDesktopSilverUi(base,{collectionEnabled:true});
 assert.ok(!silver.includes('breeze-cat-player'));assert.ok(silver.includes('silver-screen'));
});
test('cat player favorites, gallery reload and favorite failure preserve original audio without synthesis',async()=>{
 const dom=new JSDOM(buildBreezeSilverUi({collectionEnabled:true}),{runScripts:'outside-only'}),w=dom.window;
 w.HTMLMediaElement.prototype.pause=function(){};w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};
 const wav=pcm24ToWav16(Buffer.alloc(24000));
 const record={id:'voice_'+'c'.repeat(32),source:'breeze',generated:true,desktopDirect04:true,text:'离线测试。',audioMimeType:'audio/wav',audioBase64:wav.toString('base64'),durationSeconds:.5};
 const receipt={createdAt:'2026-11-12T00:00:00Z',signature:'test'};
 const calls=[];let fail=false,saved=false,starts=0;
 w.AudioContext=class{constructor(){this.state='running';this.currentTime=0;}async resume(){}async close(){}async decodeAudioData(bytes){assert.deepEqual(Buffer.from(bytes),wav);return {duration:.5,sampleRate:16000,numberOfChannels:1};}createBufferSource(){return {connect(){},disconnect(){},start(){starts++},stop(){}};}};
 w.parent.postMessage=msg=>{
  if(msg.method!=='tools/call')return;const name=msg.params.name;calls.push(name);let result={};
  if(name==='save_shenshu_voice_favorite'){assert.equal(msg.params.arguments.record.audioBase64,record.audioBase64);if(fail)result={isError:true};else{saved=true;result={structuredContent:{saved:true}};}}
  else if(name==='remove_shenshu_voice_favorite'){saved=false;result={structuredContent:{removed:true}};}
  else if(name==='list_shenshu_voice_favorites')result={_meta:{shenshuCollectionPage:{records:saved?[{id:record.id,body:record.text,createdAt:receipt.createdAt,duration:.5}]:[],cursor:null}}};
  else if(name==='get_shenshu_voice_favorite')result={_meta:{shenshuPrivateAudio:{record},shenshuCollection:{receipt,saved:true}}};
  else assert.fail('unexpected generation or provider call: '+name);
  queueMicrotask(()=>w.dispatchEvent(new w.MessageEvent('message',{source:w.parent,data:{jsonrpc:'2.0',id:msg.id,result}})));
 };
 w.eval(w.document.querySelector('script').textContent);
 await w.eval('breezePending('+JSON.stringify({structuredContent:{id:record.id,state:'ready'},_meta:{shenshuPrivateAudio:{record},shenshuCollection:{receipt}}})+')');
 const tick=()=>new Promise(r=>setImmediate(r)),d=w.document;
 assert.equal(d.querySelectorAll('#wave i').length,16);
 d.getElementById('favorite').click();await tick();assert.equal(d.getElementById('favorite').getAttribute('aria-pressed'),'true');
 d.getElementById('gallery-open').click();await tick();assert.equal(d.querySelector('.gallery-row p').textContent,record.text);
 d.querySelector('.gallery-actions button').click();await tick();assert.equal(starts,0,'loading a favorite must not autoplay');
 d.getElementById('play').click();await tick();assert.equal(starts,1);assert.equal(d.getElementById('play').getAttribute('aria-label'),'暂停语音');
 d.getElementById('play').click();await tick();
 d.getElementById('favorite').click();await tick();assert.equal(d.getElementById('favorite').getAttribute('aria-pressed'),'false');
 fail=true;d.getElementById('favorite').click();await tick();assert.match(d.getElementById('favorite-status').textContent,/未完成/);
 assert.equal(d.getElementById('play').disabled,false);d.getElementById('play').click();await tick();assert.equal(starts,2,'favorite failure leaves original audio playable');
 assert.ok(calls.every(n=>/^(save|remove|list|get)_shenshu_voice_favorite(s)?$/.test(n)));
 dom.window.close();
});
