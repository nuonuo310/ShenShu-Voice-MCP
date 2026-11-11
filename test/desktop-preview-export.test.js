import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {JSDOM,VirtualConsole} from 'jsdom';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
for(const storageBlocked of [false,true])test(`exported preview works inside a parent frame; storage blocked=${storageBlocked}`,async()=>{
 const dir=mkdtempSync(join(tmpdir(),'shenshu-preview-'));
 let dom;
 try{
  const path=join(dir,'preview.html');
  execFileSync(process.execPath,['scripts/preview-desktop-collection.mjs','--export',path],{cwd:new URL('..',import.meta.url)});
  dom=new JSDOM(readFileSync(path,'utf8'),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://embedded-preview.invalid/',virtualConsole:new VirtualConsole()});
  const w=dom.window;let parentCalls=0;
  // A Library HTML preview has a real parent. The former standalone-only
  // test (parent===self) missed RPC accidentally sent to that real parent.
  Object.defineProperty(w,'parent',{value:{postMessage(){parentCalls++;}}});
  if(storageBlocked)Object.defineProperty(w,'localStorage',{get(){throw new w.DOMException('denied','SecurityError')}});
  w.HTMLMediaElement.prototype.pause=function(){};
  for(const script of w.document.querySelectorAll('script'))w.eval(script.textContent);
  await tick();const $=id=>w.document.getElementById(id);
  assert.equal($('favorite').disabled,false);assert.equal($('play').disabled,false);
  $('favorite').click();await tick();
  assert.equal($('favorite').getAttribute('aria-pressed'),'true');assert.equal($('favorite-status').textContent,'已收藏');
  assert.equal($('favorite').disabled,false);
  $('gallery-open').click();await tick();assert.equal($('gallery-list').children.length,1);
  $('gallery-list').querySelector('button').click();await tick();assert.match($('gallery-status').textContent,/已载入/);
  $('gallery-list').querySelectorAll('button')[1].click();await tick();assert.equal($('gallery-list').children.length,0);
  assert.equal($('play').disabled,false);assert.equal(parentCalls,0);
  assert.ok(!$('status').textContent.includes('初始化失败'));
  if(storageBlocked)assert.match($('preview-note').textContent,/收藏仅本次演示/);
  else assert.equal(w.localStorage.getItem('shenshu:silver-preview-only'),null);
 }finally{dom?.window.close();rmSync(dir,{recursive:true,force:true});}
});
