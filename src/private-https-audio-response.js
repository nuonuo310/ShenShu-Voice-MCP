/** P2X offline authenticated HTTPS audio response contract. No route mounted. */
import {validateWav} from "./contract.js";

/** trustedRequest is interpreted only by a server-owned OAuth verifier. */
export async function prepareAuthorizedAudioHttpResponse({trustedRequest,authorize,loadAudio}) {
  if(typeof authorize!=="function"||typeof loadAudio!=="function")throw Error("delivery_unavailable");
  const identity=await authorize(trustedRequest);
  if(identity?.authenticated!==true||typeof identity.subject!=="string"||identity.subject.length<8)
    throw Error("not_authorized");
  // Audio is loaded only after verified identity; no caller-selected path or URL.
  const audio=await loadAudio({verifiedSubject:identity.subject});
  if(!Buffer.isBuffer(audio))throw Error("invalid_audio");
  validateWav(audio);
  return Object.freeze({
    status:200,
    headers:Object.freeze({
      "Content-Type":"audio/wav",
      "Content-Length":String(audio.length),
      "Cache-Control":"private, no-store, max-age=0",
      "X-Content-Type-Options":"nosniff",
      "Content-Disposition":"inline",
      "Vary":"Authorization"
    }),
    body:Buffer.from(audio)
  });
}
