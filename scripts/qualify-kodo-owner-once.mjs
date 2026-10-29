/**
 * OWNER-ONLY one-time real Qiniu Kodo Singapore encrypted WAV PUT + 3 GET.
 * Unlike the consumed historic CAS trial: NO DELETE/HEAD/LIST/IfMatch.
 * Run only with --run in own local interactive Node24 PowerShell terminal.
 * No real voice or MiniMax; no secrets or plaintext objects persisted.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { deriveCanonicalPrincipal } from "../src/canonical-principal.js";
import { makeInlineToneFixture } from "../src/inline-fixture.js";
import { validateWav } from "../src/contract.js";
import {
  KODO_DEFAULT_PREFIX,
  createP2KodoS3Client,
  createP2KodoPrivateAudioBackend,
} from "../src/p2-kodo-private-audio-backend.js";

const BUCKET="shenshu-voice-v1-sg-20261029";
const REGION="ap-southeast-1";
const ENDPOINT="s3.ap-southeast-1.qiniucs.com";
const PREFIX=KODO_DEFAULT_PREFIX;
const MAX_REQUESTS=4, MAX_PUT_BYTES=256*1024, MAX_GET_TOTAL=768*1024;
const WINDOW_MS=15*60*1000, REQUEST_TIMEOUT=8_000;
const MARKER="kodo-sg-owner-get-20261030-once.lock";
function stop(reason){throw Object.assign(new Error(reason),{code:reason});}
function req(x,reason){if(!x)stop(reason);}
function safeError(e){return typeof e?.code==="string" && /^[a-z0-9_]{3,90}$/.test(e.code)?e.code:"kodo_unknown_stop";}
async function promptMasked(label) {
  const input=process.stdin;
  req(input.isTTY && process.stdout.isTTY && typeof input.setRawMode==="function","interactive_terminal_required");
  process.stdout.write(label+"（不显示输入，按回车完成）: ");
  let val="",wasRaw=input.isRaw;
  return new Promise((resolve,reject)=>{
    function end(){input.off("data",onData);input.setRawMode(wasRaw);input.pause();}
    function onData(buf){
      for(const c of buf){
        if(c===3){end();process.stdout.write("\n");reject(new Error("cancelled"));return;}
        if(c===10||c===13){end();process.stdout.write("\n");resolve(val);return;}
        if(c===8||c===127){val=val.slice(0,-1);continue;}
        if(c>=33&&c<=126&&val.length<256)val+=String.fromCharCode(c);
      }
    }
    input.setRawMode(true);input.resume();input.on("data",onData);
  });
}
async function oneShotLock(){
  const path=join(process.env.LOCALAPPDATA||homedir(),"ShenShuVoice");
  await mkdir(path,{recursive:true});
  let h;
  try{h=await open(join(path,MARKER),"wx",0o600);}
  catch(e){if(e?.code==="EEXIST")stop("already_attempted_do_not_retry");stop("one_time_lock_unavailable");}
  try{await h.writeFile(JSON.stringify({bucket:BUCKET,createdAt:new Date().toISOString(),note:"Do not remove or retry without new total-control approval."}));}
  finally{await h.close();}
}
async function main() {
  req(process.argv.length===3 && process.argv[2]==="--run","explicit_run_flag_required");
  req(Number(process.versions.node.split(".")[0])===24,"node24_required");
  req(process.stdin.isTTY && process.stdout.isTTY,"interactive_terminal_required");
  process.stdout.write("\n沈述 Voice V1｜Kodo 私有 owner 加密音频单次真实资格\n");
  process.stdout.write("指定新加坡私有 Bucket，一份新 synthetic 440Hz WAV；1 PUT / 3 GET；不删除、不重试、不调用 MiniMax。\n");
  process.stdout.write("每次上传≤256KiB、总 GET≤768KiB、最多15分钟。产生的密文对象靠已配置的一天生命周期清理，可能有少量流量费用。\n");
  const accessKeyId=await promptMasked("七牛专用子用户 AK");
  const secretAccessKey=await promptMasked("七牛专用子用户 SK");
  req(/^[A-Za-z0-9_+\-/=]{8,128}$/.test(accessKeyId),"access_key_invalid");
  req(/^[A-Za-z0-9_+\-/=]{16,256}$/.test(secretAccessKey),"secret_key_invalid");
  await oneShotLock();
  const since=Date.now(),deadline=since+WINDOW_MS,used={PutObjectCommand:0,GetObjectCommand:0};
  let logical=0,physical=0,putBytes=0,getBytes=0;
  const base=createP2KodoS3Client({accessKeyId,secretAccessKey,requestTimeoutMs:REQUEST_TIMEOUT});
  const handler=base.config.requestHandler;
  const checkedHandler={
    async handle(request,options) {
      req(Date.now()<deadline,"time_budget_exhausted");
      req(physical<MAX_REQUESTS,"wire_request_budget_exhausted");
      req(request?.protocol==="https:" && request?.hostname===ENDPOINT &&
        (!request.port||Number(request.port)===443) &&
        typeof request.path==="string" && request.path.startsWith("/"+BUCKET+"/") &&
        ["PUT","GET"].includes(request.method),"unexpected_wire_target");
      req(/^AWS4-HMAC-SHA256 /.test(request?.headers?.authorization??request?.headers?.Authorization??""),"unsigned_s3_request");
      physical++;
      // Do not convert a legitimate S3 NoSuchKey/404 to a generic network
      // error: the owner-isolation negative GET must be observable.
      // Unexpected transport errors still STOP in audited.send() without retry.
      return handler.handle(request,options);
    }
  };
  const real=createP2KodoS3Client({
    accessKeyId,secretAccessKey,requestTimeoutMs:REQUEST_TIMEOUT,requestHandler:checkedHandler
  });
  const audited=Object.freeze({
    async send(command,opts={}) {
      const kind=command?.constructor?.name;
      req(kind==="PutObjectCommand"||kind==="GetObjectCommand","forbidden_s3_command");
      req(Date.now()<deadline && logical<MAX_REQUESTS,"request_or_time_budget_exhausted");
      req(command.input?.Bucket===BUCKET && typeof command.input?.Key==="string" &&
        command.input.Key.startsWith(PREFIX),"wrong_bucket_or_prefix");
      req(used[kind] < (kind==="PutObjectCommand"?1:3),"operation_budget_exhausted");
      if(kind==="PutObjectCommand") {
        req(Buffer.isBuffer(command.input?.Body) &&
          command.input.Body.length<=MAX_PUT_BYTES,"oversized_put");
        putBytes+=command.input.Body.length;
      }
      used[kind]++; logical++;
      let response;
      try{
        response=await real.send(command,{
          ...opts,abortSignal:AbortSignal.any([
            AbortSignal.timeout(Math.min(REQUEST_TIMEOUT,deadline-Date.now())),
            ...(opts.abortSignal?[opts.abortSignal]:[]),
          ]),
        });
      }catch(e){
        if(kind==="GetObjectCommand" && 
          (e?.name==="NoSuchKey" || e?.name==="NotFound" || e?.$metadata?.httpStatusCode===404)) {
          throw e; // The app backend must interpret genuine 404 as owner isolation.
        }
        stop("kodo_s3_response_unknown_stop_no_retry");
      }
      if(kind==="GetObjectCommand" && response?.Body) {
        const original=response.Body;
        response.Body=(async function*(){
          for await(const part of original){
            const n=Buffer.from(part);
            getBytes+=n.length;
            if(getBytes>MAX_GET_TOTAL){original.destroy?.();stop("get_byte_budget_exhausted");}
            yield n;
          }
        })();
      }
      return response;
    },
  });
  const key=randomBytes(32);
  const owner=deriveCanonicalPrincipal({issuer:"urn:shenshu:kodo:synthetic-only",subject:randomUUID()});
  const foreign=deriveCanonicalPrincipal({issuer:"urn:shenshu:kodo:synthetic-only",subject:randomUUID()});
  const backend=createP2KodoPrivateAudioBackend({
    s3Client:audited,bucket:BUCKET,prefix:PREFIX,masterKey:key,
    requestTimeoutMs:REQUEST_TIMEOUT,clock:()=>new Date()
  });
  const fixture=Buffer.from(makeInlineToneFixture().audioBase64,"base64");
  const wav=validateWav(fixture);
  const now=Date.now();
  try {
    await backend.putLatest({
      principal:owner,recordId:"voice_"+randomBytes(16).toString("hex"),
      audio:fixture,mimeType:"audio/wav",durationSeconds:wav.durationSeconds,
      createdAt:new Date(now).toISOString(),expiresAt:new Date(now+60_000).toISOString()
    });
    process.stdout.write("步骤通过：1/4 私有加密 PUT（无 DELETE 能力）\n");
    const current=await backend.getLatest({principal:owner,now:new Date(now+1000).toISOString()});
    req(current?.audio?.equals(fixture)===true,"owner_wav_mismatch");
    process.stdout.write("步骤通过：2/4 owner GET 解密 WAV 完整一致\n");
    const denied=await backend.getLatest({principal:foreign,now:new Date(now+1000).toISOString()});
    req(denied===null,"foreign_owner_received_audio");
    process.stdout.write("步骤通过：3/4 另一个 owner 无法取得对象\n");
    const expired=await backend.getLatest({principal:owner,now:new Date(now+61_000).toISOString()});
    req(expired===null,"expired_audio_still_readable");
    req(logical===MAX_REQUESTS && physical===MAX_REQUESTS &&
      used.PutObjectCommand===1 && used.GetObjectCommand===3,
      "request_count_invariant_failed");
    process.stdout.write("步骤通过：4/4 过期只拒读，不发送 DELETE\n");
    process.stdout.write("\nQUALIFICATION_PASS\n"+JSON.stringify({
      lane:"Kodo_only",bucket:BUCKET,region:REGION,requests:logical,physicalHttps:physical,
      putBytes,getBytes,objectCount:1,noDelete:true,noMiniMax:true,
      elapsedSeconds:Math.round((Date.now()-since)/1000),
      physicalRemoval:"prefix_bucket_lifecycle_only"
    },null,2)+"\n");
  } finally {
    real.destroy();base.destroy();key.fill(0);fixture.fill(0);
  }
}
main().catch(e=>{
  process.stdout.write("\nQUALIFICATION_STOP: "+safeError(e)+"\n");
  process.stdout.write("禁止重试/解锁/手动删除；如留有加密合成对象，等待已存在的一天生命周期规则兜底。\n");
  process.exitCode=1;
});
