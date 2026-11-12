/** P2X: private HTTPS audio delivery primitives. Offline-only, no route mounted. */
import {randomBytes,createHash,timingSafeEqual} from "node:crypto";
import {validateWav} from "./contract.js";

const TOKEN_BYTES=32;
const MAX_TTL_MS=60_000;
const TOKEN=/^[a-f0-9]{64}$/;
const digest=value=>createHash("sha256").update(value).digest();

/** Server-side single-use ticket store; only valid for one Render process.
 * Production must use a shared atomic store (D1 or equivalent), never this Map.
 * The opaque ticket must NOT be placed in a query string, logs or a public URL.
 */
export function createOfflinePrivateAudioTickets({clock=()=>Date.now(),random=()=>randomBytes(TOKEN_BYTES)}={}) {
  const entries=new Map();
  return Object.freeze({
    issue({verifiedSubject,audio,ttlMs=30_000}) {
      if(typeof verifiedSubject!=="string"||verifiedSubject.length<8)throw Error("not_authorized");
      if(!Buffer.isBuffer(audio))throw Error("invalid_audio");
      validateWav(audio);
      if(!Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>MAX_TTL_MS)throw Error("invalid_ttl");
      const token=random().toString("hex");
      if(!TOKEN.test(token)||entries.has(token))throw Error("invalid_ticket");
      entries.set(token,{subjectDigest:digest(verifiedSubject),audio:Buffer.from(audio),expires:clock()+ttlMs});
      return token;
    },
    consume({token,verifiedSubject}) {
      if(!TOKEN.test(token??"")||typeof verifiedSubject!=="string")throw Error("not_authorized");
      const entry=entries.get(token);
      if(!entry)throw Error("not_authorized");
      // Delete before returning; expired or wrong-user tickets are never reusable.
      entries.delete(token);
      if(clock()>entry.expires||!timingSafeEqual(entry.subjectDigest,digest(verifiedSubject)))throw Error("not_authorized");
      return Buffer.from(entry.audio);
    }
  });
}
