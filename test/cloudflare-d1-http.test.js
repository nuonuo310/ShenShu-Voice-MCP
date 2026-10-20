import {test} from "node:test";
import assert from "node:assert/strict";
import {createCloudflareD1Http} from "../src/cloudflare-d1-http.js";
const env={
 CF_D1_ACCOUNT_ID:"0123456789abcdef0123456789abcdef",
 CF_D1_DATABASE_ID:"123e4567-e89b-12d3-a456-426614174000",
 CF_D1_API_TOKEN:"token_abcdefghijklmnopqrstuvwxyz123456"
};
test("D1 HTTP client posts parameterized query to fixed Cloudflare endpoint",async()=>{
 let seen;const client=createCloudflareD1Http({env,fetchImpl:async(url,opts)=>{
   seen={url,opts};return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify({
     success:true,result:[{success:true,results:[{request_id:"r",slot:1}]}]
   })};
 }});
 const rows=await client.query("SELECT ?1 AS request_id, ?2 AS slot",["r",1]);
 assert.deepEqual(rows,[{request_id:"r",slot:1}]);
 assert.match(seen.url,/api\.cloudflare\.com\/client\/v4\/accounts\/0123456789abcdef0123456789abcdef\/d1\/database\/123e4567-e89b-12d3-a456-426614174000\/query$/);
 assert.equal(seen.opts.headers.Authorization,"Bearer "+env.CF_D1_API_TOKEN);
 assert.deepEqual(JSON.parse(seen.opts.body).params,["r",1]);
});
test("configuration and API failures fail closed",async()=>{
 assert.throws(()=>createCloudflareD1Http({env:{}}),/d1_not_configured/);
 const client=createCloudflareD1Http({env,fetchImpl:async()=>({ok:false})});
 await assert.rejects(()=>client.query("SELECT 1"),/d1_unavailable/);
});
