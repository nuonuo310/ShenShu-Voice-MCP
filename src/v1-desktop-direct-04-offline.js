/**
 * DESKTOP DIRECT 04 — offline, deliberately UNMOUNTED composition slice.
 *
 * Trust boundary: the UI/model MUST NOT call this function directly.
 * A future owner-confirmed APP-ONLY tool handler must inject a verified
 * principal and a durable atomic one-use grant consumer; this module refuses
 * caller-controlled authorization and returns a bounded private inline WAV
 * record to the EXISTING ChatGPT host Web Audio bubble.
 *
 * This has NO Kodo, D1 SDK, provider fetch, secrets or new HTTP routes.
 * It does not itself authorize a paid TTS call or enable one on Render.
 */
import {createHash, randomUUID} from "node:crypto";
import {checkText, validateWav} from "./contract.js";
import {createLiveVoice} from "./live-voice.js";
import {prepareGeneratedWebAudioBridge} from "./generated-audio-playback-contract.js";

export const DESKTOP_04_VOICE_ID="ShenShuCN04Ziran_20261025220130";
export const DESKTOP_04_MODEL_ID="speech-2.8-hd";
const HANDLE=/^[A-Za-z0-9_-]{43}$/;
const PRINCIPAL=/^[A-Za-z0-9_-]{43}$/;
const REQUEST_ID=/^[A-Za-z0-9_-]{8,128}$/;

export function createDesktopDirect04Offline({
  resolveVerifiedPrincipal,
  consumeConfirmedOneUseGrant,
  synthesize,
  makeRequestId=randomUUID,
}={}) {
  if(typeof resolveVerifiedPrincipal!=="function"||
     typeof consumeConfirmedOneUseGrant!=="function"||
     typeof synthesize!=="function"||
     typeof makeRequestId!=="function") {
    throw new Error("desktop_direct_unavailable");
  }
  return async function confirmAndGenerate({trustedRequest,handle,text}={}) {
    if(!trustedRequest || typeof trustedRequest!=="object" ||
       !HANDLE.test(handle??"")) throw new Error("invalid_confirmation");
    const safeText=checkText(text);
    const requestId=makeRequestId();
    if(!REQUEST_ID.test(requestId??"")) throw new Error("invalid_request_id");

    // Only a server-supplied trusted request can identify the principal.
    // No principal, voice, model or grant can be supplied by tool arguments.
    const identity=await resolveVerifiedPrincipal(trustedRequest);
    if(!identity || identity.verified!==true ||
       !PRINCIPAL.test(identity.principal??""))throw new Error("not_authorized");
    const principal=identity.principal;
    const textDigest=createHash("sha256").update(safeText,"utf8").digest("base64url");
    const textBytes=Buffer.byteLength(safeText,"utf8");

    const result=await createLiveVoice({
      text:safeText,requestId,
      authorize:async ({action,textBytes:authorizedBytes,requestId:authorizedId})=>{
        if(action!=="generate_shenshu_voice"||
           authorizedBytes!==textBytes||
           authorizedId!==requestId)throw new Error("not_authorized");
        // This must be an atomic, durable SERVER-side confirmation claim.
        // Any ambiguous outcome is consumed and is NEVER refunded or replayed.
        const grant=await consumeConfirmedOneUseGrant({
          trustedRequest,principal,handle,requestId,textDigest,textBytes
        });
        if(grant?.allowed!==true||grant?.oneTime!==true||
           grant?.consumed!==true||grant?.principal!==principal||
           grant?.requestId!==requestId)throw new Error("not_authorized");
        return {allowed:true,oneTime:true,principal};
      },
      synthesize:async({text:providerText,voiceId,modelId})=>{
        if(providerText!==safeText||
           voiceId!==DESKTOP_04_VOICE_ID||
           modelId!==DESKTOP_04_MODEL_ID)throw new Error("model_mismatch");
        // Exactly one injected attempt; a real MiniMax adapter is NOT
        // supplied or called by this dormant offline component.
        const audio=await synthesize({
          text:safeText,modelId:DESKTOP_04_MODEL_ID,voiceId:DESKTOP_04_VOICE_ID
        });
        const metadata=validateWav(audio?.audio);
        return {audio:audio.audio,...metadata};
      },
      voiceId:DESKTOP_04_VOICE_ID,
      modelId:DESKTOP_04_MODEL_ID,
    });
    // Same generated-WAV contract as the already-audible desktop OAuth
    // host bridge. No public audio URL and no Kodo storage.
    prepareGeneratedWebAudioBridge(result.record);
    return Object.freeze({
      content:[{type:"text",text:"沈述 04 语音已交付官端气泡。保留原文字；请手动播放。"}],
      structuredContent:{record:result.record},
    });
  };
}
