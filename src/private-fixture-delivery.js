/** P2X offline-only audio delivery contract. NOT registered on any MCP route. */
import {checkText, validateWav, MAX_WAV_BYTES} from "./contract.js";

/** A trusted caller must authenticate before requesting the fixture. */
export async function preparePrivateFixtureAudio({text, trustedRequest, authorize, loadFixture}) {
  const safeText=checkText(text);
  if(typeof authorize!=="function"||typeof loadFixture!=="function")throw Error("delivery_unavailable");
  const decision=await authorize({trustedRequest,action:"private_fixture_audio"});
  if(decision?.authenticated!==true || decision?.allowed!==true)throw Error("not_authorized");
  const audio=await loadFixture();
  if(!Buffer.isBuffer(audio)||audio.length>MAX_WAV_BYTES)throw Error("invalid_audio");
  const meta=validateWav(audio);
  return Object.freeze({
    text:safeText,
    generated:false,
    source:"private-fixture",
    audioMimeType:meta.mimeType,
    audioBase64:audio.toString("base64"),
    durationSeconds:meta.durationSeconds
  });
}
