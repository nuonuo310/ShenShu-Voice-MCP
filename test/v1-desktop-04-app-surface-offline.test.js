import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {makeInlineToneFixture} from "../src/inline-fixture.js";
import {createDesktopDirect04Offline} from "../src/v1-desktop-direct-04-offline.js";
import {
 createDesktop04AppSurfaceOffline,DESKTOP_04_CONFIRM_TOOL,
 DESKTOP_04_PREPARE_TOOL,DESKTOP_04_UI_RESOURCE,
} from "../src/v1-desktop-04-app-surface-offline.js";

const principal="P".repeat(43);
const handle="H".repeat(43);
const originText="爱爱，过来，哥哥想抱抱你。";
const now=Date.parse("2026-11-03T12:00:00Z");
const fixture=Buffer.from(makeInlineToneFixture().audioBase64,"base64");
const verifiedRequest={headers:{authorization:"Bearer "+"a".repeat(45)}};

function makeWorld({returnWrongOwner=false,tamper=false,expired=false}={}){
 const calls=[];
 let approved=false;
 let pending=null;
 const resolver=async({headers})=>{
   assert.equal(headers.authorization,verifiedRequest.headers.authorization);
   calls.push("verify");
   return {verified:true,principal};
 };
 const broker={initiate:async({trustedRequest,text})=>{
   assert.equal(trustedRequest.headers.authorization,verifiedRequest.headers.authorization);
   calls.push("prepare");
   assert.equal(text,originText);
   pending={
     principal:returnWrongOwner?"x".repeat(43):principal,
     handle,
     state:"pending_confirmation",
     text:originText,
     textDigest:tamper?"wrong":createHash("sha256").update(originText).digest("base64url"),
     textBytes:Buffer.byteLength(originText,"utf8"),
     expiresAt:new Date(now+(expired?-1:300000)).toISOString(),
   };
   return {status:"pending_confirmation",handle,expiresAt:new Date(now+300000).toISOString(),billable:false};
 }};
 const direct=createDesktopDirect04Offline({
   resolveVerifiedPrincipal:resolver,
   consumeConfirmedOneUseGrant:async({principal:p,handle:h,requestId,textDigest,textBytes})=>{
     calls.push("consume");
     if(p!==principal||h!==handle||approved)return {allowed:false};
     assert.equal(textDigest,pending.textDigest);
     assert.equal(textBytes,pending.textBytes);
     approved=true;
     return {allowed:true,oneTime:true,consumed:true,principal,requestId};
   },
   synthesize:async ({text,voiceId,modelId})=>{
     calls.push("synthesize");
     assert.equal(text,originText);
     assert.equal(voiceId,"ShenShuCN04Ziran_20261025220130");
     assert.equal(modelId,"speech-2.8-hd");
     return {audio:Buffer.from(fixture)};
   },
   makeRequestId:()=> "desktop-04-request-001",
 });
 const surface=createDesktop04AppSurfaceOffline({
   verifiedRequest,resolveVerifiedPrincipal:resolver,broker,
   loadOwnedPending:async({trustedRequest,principal:p,handle:h})=>{
     calls.push("lookup");
     assert.equal(trustedRequest.headers.authorization,verifiedRequest.headers.authorization);
     assert.equal(p,principal);
     assert.equal(h,handle);
     return pending;
   },
   confirmAndGenerate:direct,clock:()=>now,
 });
 return {surface,calls, getApproved:()=>approved};
}

test("the only model-visible entry is nonbillable prepare; confirmation is app-only",()=>{
 const t=makeWorld();
 const [prepare,confirm]=t.surface.tools;
 assert.equal(prepare.name,DESKTOP_04_PREPARE_TOOL);
 assert.equal(prepare._meta.ui.resourceUri,DESKTOP_04_UI_RESOURCE);
 assert.deepEqual(prepare._meta.ui.visibility,["model","app"]);
 assert.equal(confirm.name,DESKTOP_04_CONFIRM_TOOL);
 assert.deepEqual(confirm._meta.ui.visibility,["app"]);
 assert.equal(confirm.annotations.destructiveHint,true);
 assert.deepEqual(prepare.securitySchemes,[{type:"oauth2",scopes:["voice:speak"]}]);
});

test("prepare creates only a pending text card; clicking app-only confirm returns private metadata and exact WAV",async()=>{
 const t=makeWorld();
 const prep=await t.surface.call(DESKTOP_04_PREPARE_TOOL,{text:originText});
 assert.equal(prep.structuredContent.desktop04Pending,true);
 assert.equal(prep.structuredContent.text,originText);
 assert.equal(prep.structuredContent.handle,handle);
 assert.equal(prep.structuredContent.billable,false);
 assert.deepEqual(t.calls,["verify","prepare"]);
 const result=await t.surface.call(DESKTOP_04_CONFIRM_TOOL,{handle});
 assert.deepEqual(t.calls,["verify","prepare","verify","lookup","verify","consume","synthesize"]);
 assert.equal(t.getApproved(),true);
 assert.equal(result.structuredContent.status,"audio_ready");
 assert.equal(result._meta.shenshuPrivateAudio.record.text,originText);
 assert.deepEqual(Buffer.from(result._meta.shenshuPrivateAudio.record.audioBase64,"base64"),fixture);
 const modelVisible=JSON.stringify({content:result.content,structuredContent:result.structuredContent});
 assert.equal(modelVisible.includes("audioBase64"),false);
 assert.equal(modelVisible.includes(originText),false);
 assert.equal(modelVisible.includes(fixture.toString("base64")),false);
 assert.equal(modelVisible.includes(handle),false);
});

test("replay or text-injected app confirmation fails BEFORE a second provider call",async()=>{
 const t=makeWorld();
 await t.surface.call(DESKTOP_04_PREPARE_TOOL,{text:originText});
 await t.surface.call(DESKTOP_04_CONFIRM_TOOL,{handle});
 await assert.rejects(t.surface.call(DESKTOP_04_CONFIRM_TOOL,{handle}));
 await assert.rejects(t.surface.call(DESKTOP_04_CONFIRM_TOOL,{handle,text:originText}),/invalid_arguments/);
 assert.equal(t.calls.filter(s=>s==="synthesize").length,1);
});

test("owner mismatch and digested text mismatch block confirmation before paid attempt",async()=>{
 for(const options of [{returnWrongOwner:true},{tamper:true},{expired:true}]){
   const t=makeWorld(options);
   await t.surface.call(DESKTOP_04_PREPARE_TOOL,{text:originText});
   await assert.rejects(t.surface.call(DESKTOP_04_CONFIRM_TOOL,{handle}),/confirmation_unavailable/);
   assert.equal(t.calls.filter(s=>s==="synthesize").length,0);
   assert.equal(t.calls.filter(s=>s==="consume").length,0);
 }
});

test("untrusted bearer and unknown tools are rejected",async()=>{
 assert.throws(()=>createDesktop04AppSurfaceOffline(),/desktop04_surface_unavailable/);
 const t=makeWorld();
 await assert.rejects(t.surface.call("arbitrary_paid_tool",{}),/unknown_tool/);
 await assert.rejects(t.surface.call(DESKTOP_04_PREPARE_TOOL,{text:originText,paid:true}),/invalid_arguments/);
 assert.equal(t.calls.length,0);
});

test("source has no real provider, account keys or live activation; UI has no audio model fallback",async()=>{
 const [server,auth,surface,ui]=await Promise.all([
   readFile(new URL("../server.js",import.meta.url),"utf8"),
   readFile(new URL("../src/staging-authenticated-mcp.js",import.meta.url),"utf8"),
   readFile(new URL("../src/v1-desktop-04-app-surface-offline.js",import.meta.url),"utf8"),
   readFile(new URL("../ui/mcp-bubble.html",import.meta.url),"utf8"),
 ]);
 assert.doesNotMatch(server,/SHENSHU_DESKTOP_04_APP_ENABLED/);
 assert.match(auth,/desktop04Factory=null/);
 assert.match(auth,/SHENSHU_DESKTOP_04_APP_ENABLED==="1"/);
 assert.match(auth,/desktop04Tools=null/);
 assert.doesNotMatch(surface,/import .*minimax-adapter|import .*kodo|process\.env/);
 assert.match(ui,/confirm_shenshu_desktop_04/);
 assert.match(ui,/response\?\._meta\?\.shenshuPrivateAudio\?\.record/);
 assert.match(ui,/!next\)\{/);
 assert.doesNotMatch(ui,/sendMessage\(|ui\/message/);
});
