import {test} from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync} from "node:crypto";
import {createAuth0JwksCache,AUTH0_JWKS_URL} from "../src/auth0-jwks-cache.js";
const {publicKey}=generateKeyPairSync("rsa",{modulusLength:2048});
const jwk={...publicKey.export({format:"jwk"}),kid:"valid-key",alg:"RS256",use:"sig"};
function response(data={keys:[jwk]},headers={}) {
 const bytes=Buffer.from(JSON.stringify(data));
 return {ok:true,headers:{get:name=>headers[name]??(name==="content-type"?"application/json":null)},
  body:new ReadableStream({start(c){c.enqueue(bytes);c.close();}})};
}
test("pinned HTTPS issuer JWKS cache loads once before TTL",async()=>{
 let requests=0,now=1000;
 const cache=createAuth0JwksCache({clock:()=>now,ttlMs:2000,fetchImpl:async(url,opts)=>{
   requests++;assert.equal(url,AUTH0_JWKS_URL);
   assert.equal(opts.redirect,"error");return response();
 }});
 assert.equal((await cache.get()).keys[0].kid,"valid-key");
 await cache.get();assert.equal(requests,1);
 now+=2001;await cache.get();assert.equal(requests,2);
});
test("stale key is never accepted after failed refresh",async()=>{
 let now=1000,calls=0;
 const cache=createAuth0JwksCache({clock:()=>now,ttlMs:1000,fetchImpl:async()=>{
   calls++;if(calls===1)return response();throw Error("network_fail");
 }});
 await cache.get();now+=1001;
 await assert.rejects(cache.get(),/jwks_unavailable/);
 await assert.rejects(cache.get(),/jwks_unavailable/);
 assert.equal(calls,3);
});
test("reject malformed keys, duplicate kid, private JWK and wrong algorithm",async()=>{
 for(const bad of [
   {keys:[]},{keys:[jwk,jwk]},{keys:[{...jwk,d:"secret"}]},
   {keys:[{...jwk,alg:"HS256"}]},{keys:[{...jwk,use:"enc"}]}
 ]) {
   const cache=createAuth0JwksCache({fetchImpl:async()=>response(bad)});
   await assert.rejects(cache.get(),/jwks_unavailable/);
 }
});
test("reject excessive stream bytes and unsafe endpoint configuration",async()=>{
 const cache=createAuth0JwksCache({fetchImpl:async()=>({
  ok:true,headers:{get:()=> "application/json"},
  body:new ReadableStream({start(c){c.enqueue(Buffer.alloc(65537));c.close();}})
 })});
 await assert.rejects(cache.get(),/jwks_unavailable/);
 assert.throws(()=>createAuth0JwksCache({endpoint:"https://evil.example.com/keys"}),/invalid_jwks_configuration/);
});
test("concurrent refresh requests share one fetch and rotation replaces old keys",async()=>{
 let count=0,now=1000;
 const cache=createAuth0JwksCache({clock:()=>now,ttlMs:1000,fetchImpl:async()=>{
  count++;await new Promise(r=>setTimeout(r,10));
  return response({keys:[{...jwk,kid:count===1?"old":"new"}]});
 }});
 const [a,b]=await Promise.all([cache.get(),cache.get()]);
 assert.equal(count,1);assert.equal(a,b);
 now+=1001;assert.equal((await cache.get()).keys[0].kid,"new");
});
