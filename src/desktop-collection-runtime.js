/** Optional additive runtime. Any initialization failure leaves paid/playback intact. */
import {createPrivateVoiceCollection} from './private-voice-collection.js';
import {PRIVATE_TEXT_MASTER_KEY_ENV} from './v1-p2-staging-sealed-closure.js';
export async function composeDesktopCollection({env,identityVerifier,createD1Client}={}){
 if(env?.SHENSHU_VOICE_COLLECTION_ENABLED!=='1'||typeof identityVerifier!=='function')return null;
 try{
  const raw=env[PRIVATE_TEXT_MASTER_KEY_ENV];
  const masterKey=Buffer.from(raw,/^[A-Za-z0-9_-]{43}$/.test(raw)?'base64url':'base64');
  const collection=createPrivateVoiceCollection({client:createD1Client({env}),masterKey});
  await collection.verifySchema();return collection;
 }catch{return null;}
}
