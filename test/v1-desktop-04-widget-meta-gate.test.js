/** Offline DOM harness for the EXACT UI 04 preflight code.
 * No provider, cloud, network or real browser host calls occur.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {runInNewContext} from "node:vm";

const MARKER={version:1,marker:"widget-meta-fixed-nonsecret-v1"};
const CAPACITY_PATTERN="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function capacityReply(meta=true){
  return {
    structuredContent:{capacity_probe:true,billable:false,provider_invoked:false},
    ...(meta?{_meta:{shenshuCapacityProbe:{
      version:1,marker:"shenshu-capacity-nonsecret-v1",
      length:2_800_000,payload:CAPACITY_PATTERN.repeat(43_750),
    }}}:{}),
  };
}
const HANDLE="h".repeat(43);
const PENDING={structuredContent:{
  desktop04Pending:true,status:"pending_confirmation",billable:false,
  text:"爱爱，哥哥在这里。",handle:HANDLE,
  expiresAt:new Date(Date.now()+1000*60*5).toISOString(),
}};
function hostReply(meta=true){
  return {
    structuredContent:{bridge_verified:true,paid_voice_enabled:false,audio_returned:false},
    ...(meta?{_meta:{shenshuWidgetProbe:MARKER}}:{}),
  };
}
async function harness(){
  const html=await readFile(new URL("../ui/mcp-bubble.html",import.meta.url),"utf8");
  const a=html.indexOf("function handleDesktop04Pending(");
  const b=html.indexOf("function notify(",a);
  assert.ok(a>0&&b>a);
  const listeners=new Map();
  const nodes=new Map();
  for(const id of ["direct04-card","direct04-exact","direct04-confirm","direct04-status","status"])
    nodes.set(id,{
      id,textContent:"",hidden:id==="direct04-card",disabled:true,
      addEventListener(event,cb){listeners.set(id+":"+event,cb);},
    });
  const calls=[];
  const deferred=[];
  const code="let direct04Pending=null,direct04TransportReady=false,direct04GateSerial=0;\n"
    +html.slice(a,b)+"\n({handleDesktop04Pending})";
  const context=runInNewContext(code,{
    Date,Promise,
    isOAuthBubble:true,
    $:id=>nodes.get(id),
    request:async(method,params)=>{
      calls.push({method,params});
      if(params.name==="probe_oauth_ui_bridge"||params.name==="probe_shenshu_desktop_04_capacity")
        return new Promise(resolve=>deferred.push(resolve));
      if(params.name==="confirm_shenshu_desktop_04")
        return {structuredContent:{status:"audio_ready"},
          _meta:{shenshuPrivateAudio:{record:{source:"minimax",generated:true}}}};
      throw Error("unexpected RPC "+params.name);
    },
    validateGeneratedBridgeRecord:()=>true,
    applyResponse:()=>{},
  });
  async function completeProbe(reply){
    assert.equal(deferred.length,1);
    deferred.shift()(reply);
    await Promise.resolve();
    await Promise.resolve();
  }
  return {
    nodes,calls,deferred,
    handle:context.handleDesktop04Pending,
    click:()=>listeners.get("direct04-confirm:click")(),
    completeProbe,
  };
}

test("no click can cause a paid confirmation while the nonbillable _meta probe is pending",async()=>{
  const h=await harness();
  assert.equal(h.handle(PENDING),true);
  assert.equal(h.nodes.get("direct04-confirm").disabled,true);
  assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].params.name,"probe_oauth_ui_bridge");
  await h.click();
  assert.equal(h.calls.length,1);
});

test("a host that drops widget-only _meta MUST keep paid confirmation disabled",async()=>{
  const h=await harness();
  h.handle(PENDING);
  await h.completeProbe(hostReply(false));
  assert.equal(h.nodes.get("direct04-confirm").disabled,true);
  assert.match(h.nodes.get("direct04-status").textContent,/已阻止收费生成/);
  await h.click();
  assert.equal(h.calls.length,1);
});

test("both small and full-size metadata preflights are required before a single click can confirm",async()=>{
  const h=await harness();
  h.handle(PENDING);
  await h.completeProbe(hostReply(true));
  assert.equal(h.nodes.get("direct04-confirm").disabled,true);
  assert.equal(h.calls[1].params.name,"probe_shenshu_desktop_04_capacity");
  await h.click();
  assert.equal(h.calls.filter(x=>x.params.name==="confirm_shenshu_desktop_04").length,0);
  await h.completeProbe(capacityReply(true));
  assert.equal(h.nodes.get("direct04-confirm").disabled,false);
  await h.click();
  assert.equal(h.calls.filter(x=>x.params.name==="confirm_shenshu_desktop_04").length,1);
  await h.click();
  assert.equal(h.calls.filter(x=>x.params.name==="confirm_shenshu_desktop_04").length,1);
});

test("truncated full-size metadata blocks paid confirmation even after the small probe passed",async()=>{
  const h=await harness();
  h.handle(PENDING);
  await h.completeProbe(hostReply(true));
  await h.completeProbe(capacityReply(false));
  assert.equal(h.nodes.get("direct04-confirm").disabled,true);
  assert.match(h.nodes.get("direct04-status").textContent,/已阻止收费生成/);
  await h.click();
  assert.equal(h.calls.filter(x=>x.params.name==="confirm_shenshu_desktop_04").length,0);
});

test("forged marker or stale result never enables confirmation",async()=>{
  const h=await harness();
  h.handle(PENDING);
  await h.completeProbe({...hostReply(true),_meta:{shenshuWidgetProbe:{version:1,marker:"forged"}}});
  assert.equal(h.nodes.get("direct04-confirm").disabled,true);
  const k=await harness();
  k.handle(PENDING);
  k.handle(PENDING);
  assert.equal(k.deferred.length,2);
  k.deferred.shift()(hostReply(true));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(k.nodes.get("direct04-confirm").disabled,true);
});
