import test from "node:test";
import assert from "node:assert/strict";
import {probeLocalAudioCapabilities} from "../src/local-audio-capability-probe.js";
const fixtureBytes=new Uint8Array(44);
test("reports codec support and blob creation without playing or leaking URL",async()=>{
 let revoked=null,played=0;
 class AudioFake {canPlayType(x){assert.equal(x,"audio/wav");return "maybe"}play(){played++}}
 class BlobFake {constructor(parts,opts){assert.equal(parts[0],fixtureBytes);assert.equal(opts.type,"audio/wav")}}
 const result=await probeLocalAudioCapabilities({AudioCtor:AudioFake,BlobCtor:BlobFake,
  URLApi:{createObjectURL:()=> "blob:private-test",revokeObjectURL:u=>{revoked=u}},fixtureBytes});
 assert.deepEqual(result,{wavCapability:"maybe",blobUrlCreated:true,playbackTested:false});
 assert.equal(revoked,"blob:private-test");assert.equal(played,0);
});
test("invalid dependencies fail closed",async()=>{
 await assert.rejects(probeLocalAudioCapabilities({AudioCtor:null,BlobCtor:null,URLApi:null,fixtureBytes}),/invalid_probe_dependencies/);
});
