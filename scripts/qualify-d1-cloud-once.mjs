/**
 * OWNER-ONLY / ONCE / REAL CLOUDFLARE D1 004+005 SYNTHETIC QUALIFICATION.
 * Run only with --run in a local interactive terminal after approved cloud window.
 * No Render, provider, Kodo, or user text. No credential written, logged or sent
 * except to the exact Cloudflare API endpoint. No automatic retry / no cleanup.
 */
import { createHash, randomBytes } from "node:crypto";
import { mkdir, open } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { deriveCanonicalPrincipal } from "../src/canonical-principal.js";
import { createD1P2ConfirmationOperationStore, D1_P2_CONFIRMATION_SQL } from "../src/d1-p2-confirmation-operation-store.js";
import { createPrivateTextSealer } from "../src/v1-p2-private-text-sealer.js";
import { P2_OPERATION_ACTION, textDigest } from "../src/v1-p2-operation-contract.js";
import { STAGING_RESOURCE_ORIGIN } from "../src/protected-resource-identity.js";

const ACCOUNT = "5a1af7ea0ef8f8aea6365306d775a894";
const DATABASE = "234913cd-8901-4607-8147-31c4a4317111";
const FORBIDDEN = "c39a6895-7028-4f59-a100-1455b92c96c1";
const ENDPOINT = "https://api.cloudflare.com/client/v4/accounts/" +
  ACCOUNT + "/d1/database/" + DATABASE + "/query";
const MAX_HTTP = 36;
const MAX_INSERT = 3;
const MAX_CLAIM = 5;
const MAX_UNKNOWN = 1;
const MAX_WRITES = 12;
const WINDOW_MS = 15 * 60 * 1000;
const DEADLINE_PER_REQUEST_MS = 8_000;
const MAX_BODY = 262144;
const MARKER = "d1-p2-20261030-cloud-once.lock";
function stop(code) { throw Object.assign(new Error(code), {code}); }
function requireThat(x,code) {if(!x) stop(code);}
function status(err) {return typeof err?.code==="string" && /^[a-z0-9_]{3,90}$/.test(err.code) ? err.code : "cloud_d1_unknown_stop";}
async function secretInput(label) {
  const stdin=process.stdin;
  requireThat(stdin.isTTY && process.stdout.isTTY && typeof stdin.setRawMode==="function","local_interactive_terminal_required");
  process.stdout.write(label+"（输入不显示，按回车）: ");
  let value="";
  const wasRaw=stdin.isRaw;
  return new Promise((resolve,reject)=>{
    function cleanup(){stdin.off("data",read);stdin.setRawMode(wasRaw);stdin.pause();}
    function read(bytes) {
      for(const code of bytes) {
        if(code===3){cleanup();process.stdout.write("\n");reject(new Error("cancelled"));return;}
        if(code===13 || code===10){cleanup();process.stdout.write("\n");resolve(value);return;}
        if(code===8 || code===127){value=value.slice(0,-1);continue;}
        if(code>=33 && code<=126 && value.length<256) value+=String.fromCharCode(code);
      }
    }
    stdin.setRawMode(true);stdin.resume();stdin.on("data",read);
  });
}
async function oneRunLock() {
  const dir=join(process.env.LOCALAPPDATA||homedir(),"ShenShuVoice");
  await mkdir(dir,{recursive:true});
  let handle;
  try{handle=await open(join(dir,MARKER),"wx",0o600);}
  catch(err){if(err?.code==="EEXIST")stop("already_attempted_do_not_retry");stop("one_time_lock_unavailable");}
  try{await handle.writeFile(JSON.stringify({database:DATABASE,createdAt:new Date().toISOString(),note:"Never delete or retry without new total-control approval"}));}
  finally{await handle.close();}
}
function operationRecord(principal,id,text,now) {
  return Object.freeze({
    version:1,
    action:P2_OPERATION_ACTION,
    principal,
    handle:randomBytes(32).toString("base64url"),
    operationId:id,
    text,
    textDigest:textDigest(text),
    textBytes:Buffer.byteLength(text,"utf8"),
    origin:STAGING_RESOURCE_ORIGIN,
    state:"pending_confirmation",
    issuedAt:now,
    expiresAt:now+8*60*1000,
  });
}
function exactRows(rows,n,code){requireThat(Array.isArray(rows) && rows.length===n,code);return rows;}
async function run() {
  requireThat(process.argv.length===3 && process.argv[2]==="--run","explicit_run_flag_required");
  requireThat(Number(process.versions.node.split(".")[0])===24,"node24_required");
  requireThat(process.stdin.isTTY && process.stdout.isTTY,"interactive_terminal_required");
  requireThat(DATABASE!==FORBIDDEN && ENDPOINT.startsWith("https://api.cloudflare.com/"),"target_invalid");
  process.stdout.write("\n沈述 Voice V1｜D1 专用资格库一次性合成额度验收\n");
  process.stdout.write("只用指定资格库，3 条合成提案、最多 5 次 claim、12 次写入/36 次 HTTP、15 分钟；0 MiniMax、0 Kodo、0 删除、0 重试。\n");
  process.stdout.write("该库里的合成测试记录将保留（仅保存密文），不要手动删除或重跑。\n");
  const token=await secretInput("Cloudflare 专用短期 D1 Edit API Token");
  requireThat(/^[A-Za-z0-9._~-]{20,256}$/.test(token),"invalid_token_format");
  await oneRunLock();
  const started=Date.now(),deadline=started+WINDOW_MS;
  const counts={http:0,reads:0,inserts:0,claims:0,unknowns:0,writes:0};
  const allowedStatements=new Set([
    D1_P2_CONFIRMATION_SQL.insertPendingSealed,
    D1_P2_CONFIRMATION_SQL.claimSealed,
    D1_P2_CONFIRMATION_SQL.markUnknown,
  ]);
  async function query(sql,params=[]) {
    requireThat(typeof sql==="string" && sql.length>0 && sql.length<=12000 && Array.isArray(params) && params.length<=16,"invalid_query");
    requireThat(Date.now()<deadline,"time_budget_exhausted");
    requireThat(counts.http<MAX_HTTP,"http_budget_exhausted");
    const normalized=sql.trim();
    const isInsert=normalized===D1_P2_CONFIRMATION_SQL.insertPendingSealed;
    const isClaim=normalized===D1_P2_CONFIRMATION_SQL.claimSealed;
    const isUnknown=normalized===D1_P2_CONFIRMATION_SQL.markUnknown;
    const isRead=/^(SELECT|PRAGMA)\b/i.test(normalized) && !/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|DETACH)\b/i.test(normalized);
    requireThat(isRead||allowedStatements.has(normalized),"sql_not_approved");
    if(isInsert){requireThat(counts.inserts<MAX_INSERT,"insert_budget_exhausted");counts.inserts++;}
    else if(isClaim){requireThat(counts.claims<MAX_CLAIM,"claim_budget_exhausted");counts.claims++;}
    else if(isUnknown){requireThat(counts.unknowns<MAX_UNKNOWN,"unknown_budget_exhausted");counts.unknowns++;}
    else {requireThat(counts.reads<25,"read_budget_exhausted");counts.reads++;}
    if(!isRead){requireThat(counts.writes<MAX_WRITES,"write_budget_exhausted");counts.writes++;}
    counts.http++;
    let response;
    try {
      response=await fetch(ENDPOINT,{
        method:"POST",redirect:"error",
        signal:AbortSignal.timeout(Math.min(DEADLINE_PER_REQUEST_MS,deadline-Date.now())),
        headers:{Authorization:"Bearer "+token,"content-type":"application/json","accept":"application/json"},
        body:JSON.stringify({sql:normalized,params}),
      });
    } catch {stop("d1_transport_unknown_stop_no_retry");}
    let raw;
    try {raw=await response.text();}catch{stop("d1_response_unknown_stop_no_retry");}
    requireThat(Buffer.byteLength(raw,"utf8")<=MAX_BODY,"d1_response_too_large");
    let payload;try{payload=JSON.parse(raw);}catch{stop("d1_response_not_json");}
    if(!response.ok || payload?.success!==true || !Array.isArray(payload?.result) ||
       payload.result.length!==1 || payload.result[0]?.success!==true ||
       !Array.isArray(payload.result[0]?.results)) {
      // The only expected negative is 004 trigger's explicit 'quota_denied'.
      // All other server failures, including rate limits and unknown commits, STOP.
      if(JSON.stringify(payload).includes("quota_denied")) throw new Error("quota_denied");
      stop("d1_rejected_unknown_stop_no_retry");
    }
    return payload.result[0].results;
  }
  const sealerKey=randomBytes(32);
  const sealer=createPrivateTextSealer({masterKey:sealerKey});
  const store=createD1P2ConfirmationOperationStore({client:{query},textSealer:sealer,maximumDailyCalls:1});
  const id=randomBytes(8).toString("hex");
  const ownerA=deriveCanonicalPrincipal({issuer:"urn:shenshu:qualification-only",subject:id+":a"});
  const ownerB=deriveCanonicalPrincipal({issuer:"urn:shenshu:qualification-only",subject:id+":b"});
  const now=Date.now();
  const a=operationRecord(ownerA,"dryop_"+id+"_a","【合成测试A】D1原子领额，不生成语音。",now);
  const quota=operationRecord(ownerA,"dryop_"+id+"_q","【合成测试Q】验证同一日额度拒绝。",now);
  const b=operationRecord(ownerB,"dryop_"+id+"_b","【合成测试B】验证另一个身份独立额度。",now);
  try {
    const schema=await store.verifySchema();
    requireThat(schema?.ok && schema?.sealedText===true,"d1_004_005_schema_unqualified");
    process.stdout.write("步骤通过：1/7 真实 D1 004+005 密封表与触发器预检\n");
    // Reserve all three rows before any claim, as sealed synthetic text.
    for(const record of [a,quota,b]){
      const created=await store.createPending(record);
      requireThat(created?.created===true,"pending_creation_failed");
    }
    process.stdout.write("步骤通过：2/7 三条合成密文提案（不会调用 MiniMax）\n");
    const args={principal:ownerA,handle:a.handle,textDigest:a.textDigest,textBytes:a.textBytes,now:Date.now()};
    const attempted=await Promise.allSettled([store.claim(args),store.claim(args)]);
    requireThat(attempted.every(x=>x.status==="fulfilled"),"concurrent_claim_unknown_stop");
    const pair=attempted.map(x=>x.value);
    requireThat(pair.filter(x=>x?.claimed===true).length===1 &&
      pair.filter(x=>x?.claimed===false && x.reason==="state").length===1,
      "concurrent_claim_not_exactly_one");
    const admission=await store.attestAdmission({principal:ownerA,operationId:a.operationId});
    requireThat(admission?.admitted===true,"admission_not_attested");
    process.stdout.write("步骤通过：3/7 两个并发 claim 仅一次成功，grant 已消费\n");
    const replay=await store.claim({...args,now:Date.now()});
    requireThat(replay?.claimed===false && replay.reason==="state","replay_created_second_grant");
    requireThat((await store.get({principal:ownerB,handle:a.handle}))===null,"cross_owner_visibility");
    process.stdout.write("步骤通过：4/7 重放不再领取，其他 owner 不可读\n");
    let quotaRejected=false;
    try {
      const denied=await store.claim({principal:ownerA,handle:quota.handle,textDigest:quota.textDigest,textBytes:quota.textBytes,now:Date.now()});
      quotaRejected=denied?.claimed===false && denied.reason==="quota";
    } catch{stop("quota_outcome_unknown_stop_no_retry");}
    requireThat(quotaRejected,"quota_not_rejected");
    process.stdout.write("步骤通过：5/7 同 owner 超额 claim 被拒绝\n");
    const other=await store.claim({principal:ownerB,handle:b.handle,textDigest:b.textDigest,textBytes:b.textBytes,now:Date.now()});
    requireThat(other?.claimed===true,"independent_owner_not_admitted");
    const marked=await store.markUnknown({principal:ownerA,handle:a.handle,operationId:a.operationId,now:Date.now()});
    requireThat(marked?.updated===true,"unknown_transition_failed");
    process.stdout.write("步骤通过：6/7 独立 owner 领取，unknown 终态无退款\n");
    const states=exactRows(await query(
      "SELECT principal,operation_id,state,request_id,grant_id,text FROM paid_voice_confirmation_operations WHERE principal IN (?1,?2) ORDER BY operation_id",
      [ownerA,ownerB]),3,"bad_operation_count");
    requireThat(states.every(row=>row.text==="sealed:v1"),"private_text_not_sealed");
    const slotRows=exactRows(await query(
      "SELECT principal,request_id,slot FROM paid_voice_reservations WHERE principal IN (?1,?2)",
      [ownerA,ownerB]),2,"reservation_count_bad");
    const grants=exactRows(await query(
      "SELECT principal,request_id,grant_id,state FROM paid_voice_grants WHERE principal IN (?1,?2)",
      [ownerA,ownerB]),2,"grant_count_bad");
    requireThat(grants.every(x=>x.state==="consumed") &&
      states.find(x=>x.operation_id===a.operationId)?.state==="unknown" &&
      states.find(x=>x.operation_id===quota.operationId)?.state==="pending_confirmation" &&
      states.find(x=>x.operation_id===b.operationId)?.state==="provider_pending" &&
      slotRows.some(x=>x.principal===ownerA) && slotRows.some(x=>x.principal===ownerB),
      "atomic_ledger_invariant_failed");
    requireThat(counts.inserts===3 && counts.claims===5 && counts.unknowns===1 &&
      counts.writes<=MAX_WRITES && counts.http<=MAX_HTTP,
      "request_shape_mismatch");
    process.stdout.write("步骤通过：7/7 账本只读后验：3密文操作 / 2 reservation / 2 consumed grant\n");
    process.stdout.write("\nQUALIFICATION_PASS\n"+JSON.stringify({
      lane:"D1_only",database:DATABASE,runId:id,operations:states.length,reservations:slotRows.length,
      grants:grants.length,physicalHttp:counts.http,writes:counts.writes,
      claimAttempts:counts.claims,providerCalls:0,miniMaxCalls:0,anyDelete:false,
      seconds:Math.round((Date.now()-started)/1000)
    },null,2)+"\n");
  } finally {
    sealerKey.fill(0);
  }
}
run().catch(err=>{
  process.stdout.write("\nQUALIFICATION_STOP: "+status(err)+"\n");
  process.stdout.write("不重试、不删除锁；本轮任何已提交的合成账本行保留供总控只读审查。\n");
  process.exitCode=1;
});
