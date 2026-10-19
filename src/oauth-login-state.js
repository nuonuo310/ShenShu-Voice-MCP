/**
 * OAuth browser-login state gate (staging only). Requires an injected durable,
 * atomic, single-consume store. NEVER use process memory for deployed sessions.
 * Do not attach to public MCP or the retired voice-mcp Worker.
 */
import {randomBytes,createHash,timingSafeEqual} from "node:crypto";
const STATE=/^[A-Za-z0-9_-]{32,256}$/;
const REDIRECT=/^https:\/\/[A-Za-z0-9.-]+(?:\/[A-Za-z0-9/_-]*)?$/;
export const STATE_TTL_SECONDS=300;
export function stateDigest(value){
 if(typeof value!=="string"||!STATE.test(value))throw Error("invalid_oauth_state");
 return createHash("sha256").update(value,"utf8").digest("hex");
}
export function createOAuthLoginState({saveAtomic,consumeAtomic,now=()=>Math.floor(Date.now()/1000),random=()=>randomBytes(32).toString("base64url")}){
 if(typeof saveAtomic!=="function"||typeof consumeAtomic!=="function")throw Error("oauth_state_store_required");
 return Object.freeze({
  async start({redirectUri}){
   if(typeof redirectUri!=="string"||!REDIRECT.test(redirectUri))throw Error("invalid_redirect_uri");
   const state=random(),digest=stateDigest(state),created=now();
   if(!Number.isSafeInteger(created))throw Error("clock_error");
   const saved=await saveAtomic({digest,redirectUri,expiresAt:created+STATE_TTL_SECONDS});
   if(saved!==true)throw Error("oauth_state_unavailable");
   return Object.freeze({state,expiresAt:created+STATE_TTL_SECONDS});
  },
  async consume({state,redirectUri}){
   if(typeof redirectUri!=="string"||!REDIRECT.test(redirectUri))throw Error("invalid_redirect_uri");
   const digest=stateDigest(state),current=now();
   if(!Number.isSafeInteger(current))throw Error("clock_error");
   // Atomic deletion+return is required so competing callbacks cannot replay.
   const entry=await consumeAtomic({digest,now:current});
   if(!entry||entry.expiresAt<=current||typeof entry.redirectUri!=="string")throw Error("invalid_oauth_state");
   const a=Buffer.from(entry.redirectUri),b=Buffer.from(redirectUri);
   if(a.length!==b.length||!timingSafeEqual(a,b))throw Error("invalid_oauth_state");
   return Object.freeze({accepted:true});
  }
 });
}
