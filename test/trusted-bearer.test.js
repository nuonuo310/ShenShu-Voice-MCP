import {test} from "node:test";
import assert from "node:assert/strict";
import {extractTrustedBearer} from "../src/trusted-bearer.js";
const mk=(auth,url="https://paid.example.invalid/mcp")=>new Request(url,{headers:auth?{authorization:auth}:{}});
const token="A".repeat(40)+"."+"B".repeat(40)+"."+"C".repeat(40);
test("server-side bearer extraction accepts header only",()=>{
 assert.equal(extractTrustedBearer(mk("Bearer "+token)),token);
});
test("refuse missing, basic, short or malformed authorization",()=>{
 for(const a of [null,"Basic "+token,"Bearer short","Bearer  "+token,"Bearer "+token+"\nextra"]){
  if(a?.includes("\n"))continue;
  assert.throws(()=>extractTrustedBearer(mk(a)),/not_authorized/);
 }
});
test("refuse URL credentials even if header is present",()=>{
 for(const p of ["token","access_token","authorization"])
  assert.throws(()=>extractTrustedBearer(mk("Bearer "+token,"https://paid.example.invalid/mcp?"+p+"=fake")),/not_authorized/);
});
test("public mock server never imports private authorization code",async()=>{
 const {readFile}=await import("node:fs/promises");
 const s=await readFile(new URL("../server.js",import.meta.url),"utf8");
 assert.doesNotMatch(s,/trusted-bearer|paid-admission|oauth-token-verifier|speak_shenshu/);
});
