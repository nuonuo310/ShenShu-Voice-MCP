/** Offline-only browser-DOM model for user-selected existing MP3/WAV/M4A.
 * This feature cannot POST, upload, transcode or call MiniMax/Kodo; it just
 * creates a local object URL for the existing separate <audio> element.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const HTML_URL = new URL("../ui/private-player.html", import.meta.url);
async function html() { return readFile(HTML_URL, "utf8"); }

function instrument(htmlText) {
  const match=/<script>([\s\S]*?)<\/script>/.exec(htmlText);
  assert.ok(match, "one local inline script required");
  assert.equal(htmlText.split("<script>").length,2);
  const events=Object.create(null);
  const nodes=Object.fromEntries(["audio","load","status","local-file","local-audio","local-status"]
    .map(id=>[id,{
      id,files:null,hidden:id==="local-audio",src:"",value:"",currentTime:0,ended:false,
      paused:true,loads:0,pauses:0,
      addEventListener(type,listener){(events[id+":"+type]??=[]).push(listener);},
      pause(){this.pauses++;this.paused=true;},
      load(){this.loads++;},
      removeAttribute(name){if(name==="src")this.src="";},
    }]));
  const stored={created:[],revoked:[],calls:[],pagehide:[]};
  const fakeURL={
    createObjectURL(file){
      stored.created.push(file);
      return "blob:local-file-"+stored.created.length;
    },
    revokeObjectURL(value){stored.revoked.push(value);},
  };
  const fakeWindow={
    addEventListener(event,callback){
      if(event!=="pagehide")throw Error("unexpected event "+event);
      stored.pagehide.push(callback);
    },
  };
  runInNewContext(match[1],{
    document:{getElementById(id){if(!nodes[id])throw Error("unknown element");return nodes[id];}},
    URL:fakeURL,window:fakeWindow,
    fetch(){stored.calls.push("fetch");throw Error("network forbidden");},
    XMLHttpRequest(){stored.calls.push("xhr");throw Error("network forbidden");},
    navigator:{sendBeacon(){stored.calls.push("beacon");throw Error("network forbidden");}},
    Number,
  });
  return {
    nodes,stored,
    emit(id,event){for(const fn of events[id+":"+event]??[])fn();}
  };
}

test("local sample remains fully independent of protected server audio endpoint",async()=>{
  const page=await html();
  assert.match(page,/id="local-file" type="file"/);
  assert.match(page,/id="local-audio" controls preload="none" playsinline hidden/);
  assert.match(page,/单独试听/);
  assert.match(page,/不代表服务器私有交付通过/);
  assert.match(page,/id="load" type="button"/);
  assert.match(page,/audio\.src="\/player\/audio"/);
  assert.doesNotMatch(page,/<form[^>]*enctype\s*=\s*["']?multipart/i);
  assert.doesNotMatch(page,/\bnew\s+FormData\s*\(/);
  assert.doesNotMatch(page,/\bnavigator\.sendBeacon\s*\(/);
  const t=instrument(page);
  assert.equal(t.stored.created.length,0);
  assert.equal(t.nodes["local-audio"].src,"");
  assert.equal(t.nodes["audio"].src,"");
  assert.equal(t.stored.calls.length,0);
});

test("existing MP3 is selected locally without upload or autoplay; replacing it revokes old URL",async()=>{
  const t=instrument(await html());
  const first={name:"existing_04_original.mp3",size:12345,type:"audio/mpeg"};
  t.nodes["local-file"].files=[first];
  t.emit("local-file","change");
  assert.equal(t.stored.created.length,1);
  assert.equal(t.stored.created[0],first);
  assert.equal(t.nodes["local-audio"].src,"blob:local-file-1");
  assert.equal(t.nodes["local-audio"].hidden,false);
  assert.equal(t.nodes["local-audio"].paused,true);
  assert.equal(t.nodes["audio"].src,"");
  assert.deepEqual(t.stored.revoked,[]);
  const next={name:"voice_note.wav",size:6789,type:"audio/wav"};
  t.nodes["local-file"].files=[next];
  t.emit("local-file","change");
  assert.deepEqual(t.stored.revoked,["blob:local-file-1"]);
  assert.equal(t.nodes["local-audio"].src,"blob:local-file-2");
  assert.equal(t.stored.created.length,2);
  assert.equal(t.stored.calls.length,0);
  t.emit("local-audio","play");
  assert.match(t.nodes["local-status"].textContent,/正在播放本机/);
  t.stored.pagehide[0]();
  assert.deepEqual(t.stored.revoked,["blob:local-file-1","blob:local-file-2"]);
  assert.equal(t.nodes["local-audio"].src,"");
  assert.equal(t.nodes["local-audio"].hidden,true);
});

test("unknown formats, zero bytes and files over 16 MiB fail closed and revoke old selection",async()=>{
  const t=instrument(await html());
  t.nodes["local-file"].files=[{name:"good.m4a",size:1024,type:"audio/mp4"}];
  t.emit("local-file","change");
  assert.equal(t.stored.created.length,1);
  for(const file of [
    {name:"bad.js",size:20,type:"audio/mpeg"},
    {name:"zero.mp3",size:0,type:"audio/mpeg"},
    {name:"large.wav",size:16*1024*1024+1,type:"audio/wav"},
    {name:"broken.mp3",size:NaN,type:"audio/mpeg"},
  ]) {
    t.nodes["local-file"].files=[file];
    t.emit("local-file","change");
    assert.equal(t.nodes["local-audio"].hidden,true);
    assert.equal(t.nodes["local-audio"].src,"");
    assert.match(t.nodes["local-status"].textContent,/只能选择不超过 16 MiB/);
    assert.equal(t.nodes["local-file"].value,"");
  }
  assert.deepEqual(t.stored.revoked,["blob:local-file-1"]);
  assert.equal(t.stored.created.length,1);
  assert.equal(t.stored.calls.length,0);
});
