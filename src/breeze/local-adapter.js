/** Breeze v0.1.6 multipart contract, verified against the owner's server.cpp.
 * Local loopback only. No provider fallback, model reload, or automatic retry.
 */
import {checkText,validateWav,MAX_DURATION_SECONDS} from '../contract.js';
export const BREEZE_DAILY_PRESET=Object.freeze({voice_id:'shenshu_04_natural',seed:'7',cfg_scale:'1.2',instruction:'自然、清晰、有温度的日常对话。语气放松亲近，使用平常说话的节奏，不要朗诵。'});
const MAX_PCM=24000*2*MAX_DURATION_SECONDS;
export function localBreezeEndpoint(value='http://127.0.0.1:8080'){
 const u=new URL(value);
 if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('breeze_loopback_required');
 return new URL('/v1/audio/speech',u).href;
}
/** Band-limited 24k -> 16k conversion, preserving duration and pitch.
 * A windowed-sinc low pass attenuates content above the target Nyquist limit.
 */
export function pcm24ToWav16(pcm){
 if(!Buffer.isBuffer(pcm)||pcm.length<9600||pcm.length>MAX_PCM||pcm.length%2)throw Error('breeze_invalid_pcm');
 const count=Math.floor(pcm.length/2*2/3),out=Buffer.alloc(44+count*2);
 out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);
 out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);out.writeUInt32LE(16000,24);out.writeUInt32LE(32000,28);
 out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(count*2,40);
 const radius=48,cutoff=0.30;
 for(let i=0;i<count;i++){
  const at=i*1.5;let sum=0,weight=0;
  for(let j=Math.ceil(at-radius);j<=Math.floor(at+radius);j++){
   if(j<0||j>=pcm.length/2)continue;
   const d=at-j,x=2*cutoff*d;
   const kernel=2*cutoff*(Math.abs(x)<1e-12?1:Math.sin(Math.PI*x)/(Math.PI*x))*(.5+.5*Math.cos(Math.PI*d/radius));
   sum+=pcm.readInt16LE(j*2)*kernel;weight+=kernel;
  }
  out.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(sum/weight))),44+i*2);
 }
 validateWav(out);return out;
}
export async function synthesizeLocalBreeze({text,endpoint,fetchImpl=fetch,timeoutMs=600000,signal}={}){
 checkText(text);const url=localBreezeEndpoint(endpoint);
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>600000)throw Error('breeze_invalid_timeout');
 const form=new FormData();for(const [key,value] of Object.entries({...BREEZE_DAILY_PRESET,text}))form.set(key,value);
 const deadline=AbortSignal.timeout(timeoutMs),cancel=signal?AbortSignal.any([signal,deadline]):deadline;
 let response;
 try{response=await fetchImpl(url,{method:'POST',body:form,signal:cancel,redirect:'error'});}catch{throw Error('breeze_request_unknown');}
 if(!response.ok)throw Error(response.status===409?'breeze_busy':'breeze_http_failed');
 if(response.headers.get('content-type')?.split(';')[0]!=='audio/pcm'||response.headers.get('x-sample-rate')!=='24000'||response.headers.get('x-sample-format')!=='s16le'){
  await response.body?.cancel();throw Error('breeze_audio_contract_mismatch');
 }
 const chunks=[];let bytes=0;
 try{for await(const chunk of response.body){cancel.throwIfAborted();bytes+=chunk.length;if(bytes>MAX_PCM)throw Error();chunks.push(Buffer.from(chunk));}}catch{throw Error('breeze_audio_incomplete');}
 return pcm24ToWav16(Buffer.concat(chunks));
}
