import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM,VirtualConsole} from 'jsdom';
import {buildDesktopSilverUi} from '../src/desktop-silver-ui.js';
import {makeInlineToneFixture} from '../src/inline-fixture.js';
const raw=await readFile(new URL('../ui/mcp-bubble.html',import.meta.url),'utf8');
const html=buildDesktopSilverUi(raw.replace('const isDesktop04Bubble=false;','const isDesktop04Bubble=true;'),{collectionEnabled:true});
const record={...makeInlineToneFixture(),id:'voice_'+('a'.repeat(32)),text:'完整文字\n<img src=x onerror=alert(1)>',source:'minimax',generated:true,desktopDirect04:true};
const receipt={createdAt:'2026-11-11T12:00:00.000Z',signature:'p'.repeat(43)};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function mount(shared={saved:false}){
 const dom=new JSDOM(html,{url:'https://preview.invalid/private-fixture-bubble-v1',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
 const w=dom.window,calls=[],contexts=[];let fail=false;
 w.HTMLMediaElement.prototype.pause=function(){};
 w.AudioContext=class{
  constructor(){this.state='running';this.currentTime=0;contexts.push(this);}
  async resume(){} async close(){this.state='closed';}
  async decodeAudioData(){return {duration:record.durationSeconds,sampleRate:16000,numberOfChannels:1};}
  createBufferSource(){return this.source={connect(){},disconnect(){},start(){this.started=true},stop(){this.stopped=true}};}
 };
 w.postMessage=async msg=>{
  if(!msg.id)return;
  let result={};const q=msg.params;
  if(msg.method==='tools/call'){
   calls.push(q.name);
   if(fail)result={isError:true};
   else if(q.name==='save_shenshu_voice_favorite'){shared.saved=true;result={structuredContent:{saved:true}};}
   else if(q.name==='remove_shenshu_voice_favorite'){shared.saved=false;result={structuredContent:{removed:true}};}
   else if(q.name==='list_shenshu_voice_favorites')result={_meta:{shenshuCollectionPage:{records:shared.saved?[{id:record.id,body:record.text,createdAt:receipt.createdAt,duration:record.durationSeconds}]:[],cursor:null}}};
   else if(q.name==='get_shenshu_voice_favorite')result={_meta:{shenshuPrivateAudio:{record},shenshuCollection:{saved:true,receipt}}};
  }
  queueMicrotask(()=>w.dispatchEvent(new w.MessageEvent('message',{source:w,data:{jsonrpc:'2.0',id:msg.id,result}})));
 };
 w.eval(w.document.querySelector('script[type=module]').textContent+'\nwindow.testUi={receive:desktopCollection.receive,applyResponse,paint,getRecord:()=>record};');
 const $=id=>w.document.getElementById(id);
 return {dom,w,$,calls,contexts,fail(v){fail=v},load(){w.testUi.applyResponse({structuredContent:{record}});w.testUi.receive(record,{receipt,saved:false})},close(){w.close()}};
}
test('actual desktop module keeps play/pause/progress; save failure leaves active source and full text untouched',async()=>{
 const h=mount();try{
 h.load();assert.equal(h.$('play').disabled,false);assert.equal(h.$('favorite').disabled,false);
 h.$('play').click();await tick();assert.equal(h.contexts.length,1);const ctx=h.contexts[0];assert.equal(ctx.source.started,true);
 ctx.currentTime=record.durationSeconds/2;h.w.testUi.paint();assert.equal(h.$('silver-track').getAttribute('aria-valuenow'),'50');
 assert.equal(h.$('kiss').classList.contains('show'),true);h.fail(true);h.$('favorite').click();await tick();
 assert.equal(h.$('favorite').getAttribute('aria-pressed'),'false');assert.equal(ctx.source.stopped,undefined);assert.equal(h.$('text').textContent,record.text);
 assert.match(h.$('favorite-status').textContent,/不会重新生成/);assert.deepEqual(h.calls,['save_shenshu_voice_favorite']);
 h.$('play').click();await tick();assert.equal(ctx.source.stopped,true);assert.equal(h.$('play').getAttribute('aria-label'),'播放语音');
 }finally{h.close()}
});
test('save, recreated UI, list, load and unfavorite use existing audio, render text safely, and never call synthesis',async()=>{
 const shared={saved:false};let h=mount(shared);
 try{h.load();h.$('favorite').click();await tick();assert.equal(shared.saved,true);assert.equal(h.$('favorite').getAttribute('aria-pressed'),'true');h.close();
 h=mount(shared);h.$('gallery-open').click();await tick();assert.equal(h.$('voice-gallery').hidden,false);assert.equal(h.$('gallery-list').children.length,1);
 assert.equal(h.$('gallery-list').querySelector('img'),null);assert.equal(h.$('gallery-list').querySelector('p').textContent,record.text);
 h.$('gallery-list').querySelector('button').click();await tick();assert.equal(h.$('text').textContent,record.text);assert.equal(h.$('play').disabled,false);assert.equal(h.$('favorite').getAttribute('aria-pressed'),'true');assert.equal(h.contexts.length,0);
 h.$('gallery-list').querySelectorAll('button')[1].click();await tick();assert.equal(shared.saved,false);assert.equal(h.$('gallery-list').children.length,0);assert.equal(h.$('play').disabled,false);
 assert.ok(h.calls.every(x=>!x.includes('confirm')&&!x.includes('speak')&&!x.includes('prepare')));
 }finally{h.close()}
});
test('missing receipt disables favorite only; gallery notification opens list and fixed avatar is inline',async()=>{
 const h=mount();try{h.load();h.w.testUi.receive(record,null);assert.equal(h.$('favorite').disabled,true);assert.equal(h.$('play').disabled,false);
 h.w.dispatchEvent(new h.w.MessageEvent('message',{source:h.w,data:{jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:{collectionView:true},_meta:{shenshuCollectionPage:{records:[],cursor:null}}}}}));
 assert.equal(h.$('voice-gallery').hidden,false);assert.match(h.w.document.querySelector('.portrait img').getAttribute('src'),/^data:image\/jpeg;base64,/);
 }finally{h.close()}
});
