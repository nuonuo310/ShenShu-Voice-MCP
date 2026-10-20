import { test } from "node:test";
import assert from "node:assert/strict";
import { createPublicKey } from "node:crypto";
import { createAuth0JwksCache } from "../src/auth0-jwks-cache.js";

// Public Auth0 JWKS values supplied by the user from the tenant's official
// /.well-known/jwks.json on 2026-10-20. No secrets, tokens or certificates.
const actual={keys:[
  {kty:"RSA",use:"sig",alg:"RS256",kid:"e0gVxtW9x9tjNh7LNvLPE",
   n:"opDH5jzl_9oVjQHRNsYOaGEqrl2Pngz7Q5XjCnMv0R-Dviace5_JGJc1u8tz_h58wQzym6v2_BjjODm2skl198BotNBZFCAvd7Ar0glmc6ZZCpXH-Wp_teZ-f2u8PUY4h2kve0gzJ3nczwUVKzk8OtpSy3hcgbKqIsw1xGGKrRbLnZcU9NTjvlbptAxDzS_mcpj19dMENqphg0AAbNMu0J1jODRDWXNtdRH4hU47186GltASdW60-3ujz0SSyBjZw6u2Bsyd5Av6Vi11_ovfGIi0Xvw14GkEL4DBh8EGlikH-TLecMhUjtCAZwIOJYywLdvlt9R7BDmzwdplsdC0Rw",
   e:"AQAB"},
  {kty:"RSA",use:"sig",alg:"RS256",kid:"R9HzjCHmHPE86pa72yazT",
   n:"qIkscqVw1wX1E8BW-vCA3h8VLxHxWvUnTe7UASSiS-fUMbTquupKiFA-8q9QbM9_SriAg65zgMfUxbgqGSp1cnptJ6l8e3Wjd9dLoY70StPtZkCpBiXuRXMCk4Wg_B0FaehZASejmLgV3-2L8vKdauORZcGokdr1mV3icOhm7469oQ461Kyjfi6VwX7sgBR4Lh43zMTpjDzj9FD2OlTFwPp1Aa4ozlZbTm8kjPZfMnEOWnFRfDFdn7TKBIhrQNbSHgpzbqcFSOzXhq1Jcsc-bLfvh6cL24uUKFAplAGjae_WwYzfrVA6KY_O0eBGswAHK1tkcHPmWQi87BTRf0rnjQ",
   e:"AQAB"}
]};
function response(value){
 const bytes=Buffer.from(JSON.stringify(value));
 return {ok:true,headers:{get:n=>n==="content-type"?"application/json":null},
  body:new ReadableStream({start(c){c.enqueue(bytes);c.close();}})};
}
test("real Auth0 public JWKS fixture is accepted and yields two RS256 signing keys",async()=>{
  const cache=createAuth0JwksCache({fetchImpl:async()=>response(actual)});
  const snapshot=await cache.get();
  assert.equal(snapshot.keys.length,2);
  assert.deepEqual(snapshot.keys.map(x=>x.kid),[
    "e0gVxtW9x9tjNh7LNvLPE","R9HzjCHmHPE86pa72yazT"
  ]);
  for(const key of snapshot.keys) {
    assert.equal(key.kty,"RSA");
    assert.equal(key.use,"sig");
    assert.equal(key.alg,"RS256");
    assert.doesNotThrow(()=>createPublicKey({key,format:"jwk"}));
    assert.equal("d" in key,false);
  }
});
