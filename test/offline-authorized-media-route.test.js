import test from "node:test";
import assert from "node:assert/strict";
import {handleOfflineAuthorizedMedia} from "../src/offline-authorized-media-route.js";
import {makeInlineToneFixture} from "../src/inline-fixture.js";
const wav=Buffer.from(makeInlineToneFixture().audioBase64,"base64");
const run=async({method="GET",authorization,authorize=async()=>({authenticated:true,subject:"verified_subject_001"})}={})=>{
 let status,headers,body,loaded=0,verified=0;
 const req={method,headers:{...(authorization?{authorization}:{})}};
 const res={writeHead(s,h){status=s;headers=h;return this},end(b){body=b;return this}};
 await handleOfflineAuthorizedMedia(req,res,{authorize:async request=>{verified++;return authorize(request)},loadAudio:async()=>{loaded++;return wav}});
 return {status,headers,body,loaded,verified};
};
test("missing bearer refuses before verifier and storage",async()=>{
 const r=await run();assert.equal(r.status,401);assert.equal(r.loaded,0);assert.equal(r.verified,0);
});
test("method denied before audio or verifier",async()=>{
 const r=await run({method:"POST",authorization:"Bearer test"});assert.equal(r.status,405);assert.equal(r.loaded,0);
});
test("valid trusted auth yields no-store audio bytes",async()=>{
 const r=await run({authorization:"Bearer test"});assert.equal(r.status,200);
 assert.equal(r.headers["Content-Type"],"audio/wav");assert.match(r.headers["Cache-Control"],/no-store/);
 assert.deepEqual(r.body,wav);assert.equal(r.loaded,1);
});
test("failed identity denies audio",async()=>{
 const r=await run({authorization:"Bearer test",authorize:async()=>({authenticated:false})});
 assert.equal(r.status,401);assert.equal(r.loaded,0);
});
