/**
 * ShenShu Voice V1 -- SINGLE live Qiniu Kodo Singapore compatibility qualification.
 * Executed ONLY by the bucket owner in their LOCAL interactive terminal.
 * This is not an app server, ChatGPT tool, or provider workflow.
 * No credentials are accepted in command-line arguments, written to disk,
 * logged, or transmitted anywhere except Qiniu's pinned HTTPS S3 endpoint.
 *
 * Allowed: 2 PUT, 2 HEAD, 1 LIST, 3 GET, 2 conditional DELETE = 10 S3 operations.
 * One synthetic encrypted WAV object key in ONE approved PRIVATE Singapore bucket.
 * No retries. A permanent local marker prevents accidental reruns.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { open, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { deriveCanonicalPrincipal } from "../src/canonical-principal.js";
import { validateWav } from "../src/contract.js";
import { makeInlineToneFixture } from "../src/inline-fixture.js";
import {
  KODO_DEFAULT_PREFIX,
  createP2KodoPrivateAudioBackend,
  createP2KodoS3Client,
} from "../src/p2-kodo-private-audio-backend.js";

const BUCKET = "shenshu-voice-v1-sg-20261029";
const PREFIX = KODO_DEFAULT_PREFIX;
const MAX_COMMANDS = 10;
const MAX_OBJECT_BODY_BYTES = 256 * 1024;
const MAX_GET_BODY_BYTES = 768 * 1024;
const DEADLINE_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;
const ALLOWED = new Set([
  "PutObjectCommand",
  "GetObjectCommand",
  "HeadObjectCommand",
  "DeleteObjectCommand",
  "ListObjectsV2Command",
]);
const TARGET_COUNTS = Object.freeze({
  PutObjectCommand: 2,
  GetObjectCommand: 3,
  HeadObjectCommand: 2,
  DeleteObjectCommand: 2,
  ListObjectsV2Command: 1,
});

function stop(reason) {
  throw Object.assign(new Error(reason), { code: reason });
}
function requireExactly(ok, reason) {
  if (!ok) stop(reason);
}
function statusCode(error) {
  return Number(error?.$metadata?.httpStatusCode || 0);
}
function summaryError(error) {
  // Never print error.message: provider/SDK errors may include sensitive request paths.
  if (typeof error?.code === "string" && /^[a-z_]{3,80}$/.test(error.code)) {
    return error.code;
  }
  const status = statusCode(error);
  if (status === 401 || status === 403) return "kodo_access_denied";
  if (status === 404) return "kodo_object_not_found";
  if (status === 412) return "kodo_precondition_failed";
  return "kodo_transport_or_contract_failure";
}
function isExpectedNotFound(error) {
  return statusCode(error) === 404 || error?.name === "NoSuchKey" || error?.name === "NotFound";
}
function isExpectedPreconditionFailed(error) {
  return statusCode(error) === 412 || error?.name === "PreconditionFailed";
}

async function readMasked(label) {
  const input = process.stdin;
  if (!input.isTTY || !process.stdout.isTTY || typeof input.setRawMode !== "function") {
    stop("local_interactive_terminal_required");
  }
  process.stdout.write(`${label}（输入时不可见，按 Enter 完成）: `);
  let value = "";
  const originalRaw = input.isRaw;
  return new Promise((resolve, reject) => {
    const onData = bytes => {
      for (const code of bytes) {
        if (code === 3) {
          cleanup();
          process.stdout.write("\n");
          reject(Object.assign(new Error("cancelled"), { code: "cancelled" }));
          return;
        }
        if (code === 13 || code === 10) {
          cleanup();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (code === 8 || code === 127) {
          value = value.slice(0, -1);
          continue;
        }
        if (code >= 33 && code <= 126 && value.length < 256) {
          value += String.fromCharCode(code);
        }
      }
    };
    const cleanup = () => {
      input.off("data", onData);
      input.setRawMode(originalRaw);
      input.pause();
    };
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

async function singleRunMarker() {
  const root = process.env.LOCALAPPDATA || homedir();
  const folder = join(root, "ShenShuVoice");
  await mkdir(folder, { recursive: true });
  const path = join(folder, "kodo-sg-20261029-live-once.lock");
  let handle;
  try {
    handle = await open(path, "wx", 0o600);
  } catch (error) {
    if (error?.code === "EEXIST") stop("already_attempted_do_not_retry");
    stop("cannot_create_one_time_safety_marker");
  }
  try {
    await handle.writeFile(JSON.stringify({
      purpose: "one authorized synthetic Kodo conditional-delete qualification",
      bucket: BUCKET,
      createdAt: new Date().toISOString(),
      note: "Do not delete this marker or rerun without a new total-control decision.",
    }));
  } finally {
    await handle.close();
  }
}

async function main() {
  requireExactly(Number(process.versions.node.split(".")[0]) >= 24, "node_24_required");
  requireExactly(process.argv.length === 2, "no_command_line_arguments_allowed");
  requireExactly(process.stdin.isTTY && process.stdout.isTTY, "local_interactive_terminal_required");

  process.stdout.write("\n沈述 Voice V1 · 七牛 Kodo 新加坡私有桶一次性真实资格\n");
  process.stdout.write("固定私有桶 shenshu-voice-v1-sg-20261029；仅合成 WAV，不涉及真人声音。\n");
  process.stdout.write("最多 10 个对象请求、每个 PUT <=256KiB、GET 正文累计 <=768KiB、15 分钟；零重试。\n");
  process.stdout.write("可能产生少量按量计费；不是云服务账单硬上限。\n");
  process.stdout.write("AK/SK 在本机隐藏输入，不保存，也不显示。请只输入子用户的 AK/SK。\n");
  process.stdout.write("若旧 ETag 删除未被拒绝会立即停止，保留现场，等待生命周期自动清理。\n\n");

  const accessKeyId = await readMasked("子用户 AK");
  const secretAccessKey = await readMasked("子用户 SK");
  requireExactly(/^[A-Za-z0-9_+\-\/=]{8,128}$/.test(accessKeyId), "invalid_access_key_format");
  requireExactly(/^[A-Za-z0-9_+\-\/=]{16,256}$/.test(secretAccessKey), "invalid_secret_key_format");
  await singleRunMarker(); // marker intentionally persists even if the test fails or is interrupted

  const since = Date.now();
  const until = since + DEADLINE_MS;
  const used = Object.fromEntries([...ALLOWED].map(k => [k, 0]));
  let totalRequests = 0;
  let transportRequests = 0;
  let getBytes = 0;
  let putBytes = 0;
  // Count actual HTTPS handler invocations too, not just SDK command objects.
  // This catches any unexpected redirect/extra HTTP attempt before it can leave.
  const transportOwner = createP2KodoS3Client({
    accessKeyId, secretAccessKey, requestTimeoutMs: REQUEST_TIMEOUT_MS,
  });
  const transport = transportOwner.config.requestHandler;
  const checkedTransport = {
    async handle(request, options) {
      requireExactly(transportRequests < MAX_COMMANDS, "wire_request_budget_exhausted");
      requireExactly(Date.now() < until, "qualification_time_budget_exhausted");
      requireExactly(request?.protocol === "https:" &&
        request?.hostname === "s3.ap-southeast-1.qiniucs.com" &&
        (!request.port || Number(request.port) === 443) &&
        typeof request.path === "string" &&
        request.path.startsWith("/" + BUCKET) &&
        ["GET", "PUT", "HEAD", "DELETE"].includes(request.method),
        "unexpected_wire_destination");
      requireExactly(/^AWS4-HMAC-SHA256 /.test(
        request?.headers?.authorization ?? request?.headers?.Authorization ?? "",
      ), "unsigned_wire_request_forbidden");
      transportRequests++;
      return transport.handle(request, options);
    },
  };
  const realClient = createP2KodoS3Client({
    accessKeyId, secretAccessKey,
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
    requestHandler: checkedTransport,
  });
  // Never print or dump clients. Static credentials live in this process only.
  const auditedClient = Object.freeze({
    async send(command, options = {}) {
      const type = command?.constructor?.name;
      requireExactly(ALLOWED.has(type), "unexpected_s3_operation");
      requireExactly(totalRequests < MAX_COMMANDS, "s3_request_budget_exhausted");
      requireExactly(used[type] < TARGET_COUNTS[type], "s3_operation_type_budget_exhausted");
      requireExactly(Date.now() < until, "qualification_time_budget_exhausted");
      requireExactly(command.input?.Bucket === BUCKET, "unexpected_bucket");
      if (type === "ListObjectsV2Command") {
        requireExactly(command.input?.Prefix === PREFIX, "unexpected_prefix");
        requireExactly(command.input?.MaxKeys <= 3, "unsafe_list_size");
      } else {
        requireExactly(typeof command.input?.Key === "string" &&
          command.input.Key.startsWith(PREFIX), "unexpected_object_key");
      }
      if (type === "DeleteObjectCommand") {
        requireExactly(typeof command.input?.IfMatch === "string" &&
          command.input.IfMatch.length > 2, "unconditional_delete_forbidden");
      }
      if (type === "PutObjectCommand") {
        requireExactly(Buffer.isBuffer(command.input?.Body) &&
          command.input.Body.length <= MAX_OBJECT_BODY_BYTES &&
          (putBytes + command.input.Body.length) <= 2 * MAX_OBJECT_BODY_BYTES,
          "put_payload_budget_exceeded");
        putBytes += command.input.Body.length;
      }
      used[type]++;
      totalRequests++;
      const remaining = until - Date.now();
      requireExactly(remaining > 0, "qualification_time_budget_exhausted");
      const response = await realClient.send(command, {
        ...options,
        abortSignal: AbortSignal.any([
          AbortSignal.timeout(Math.min(REQUEST_TIMEOUT_MS, remaining)),
          ...(options?.abortSignal ? [options.abortSignal] : []),
        ]),
      });
      if (type === "GetObjectCommand" && response?.Body) {
        const original = response.Body;
        response.Body = (async function* () {
          for await (const chunk of original) {
            const bytes = Buffer.from(chunk);
            getBytes += bytes.length;
            if (getBytes > MAX_GET_BODY_BYTES) {
              original.destroy?.();
              stop("get_response_byte_budget_exceeded");
            }
            yield bytes;
          }
        })();
      }
      return response;
    },
  });

  const masterKey = randomBytes(32); // test-only, never persisted to disk or cloud config
  const backend = createP2KodoPrivateAudioBackend({
    s3Client: auditedClient,
    bucket: BUCKET,
    prefix: PREFIX,
    masterKey,
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
    maxOperations: 10,
  });
  const principal = deriveCanonicalPrincipal({
    issuer: "urn:shenshu:synthetic:kodo-compatibility-qualification",
    subject: randomUUID(),
  });
  const otherPrincipal = deriveCanonicalPrincipal({
    issuer: "urn:shenshu:synthetic:kodo-compatibility-qualification",
    subject: randomUUID(),
  });
  const fixtureA = Buffer.from(makeInlineToneFixture().audioBase64, "base64");
  const fixtureB = Buffer.from(fixtureA);
  fixtureB[44] = fixtureB[44] ^ 0x01; // tiny distinct sound sample, still valid WAV
  const duration = validateWav(fixtureA).durationSeconds;
  const now = Date.now();
  function record(audio) {
    return Object.freeze({
      principal,
      recordId: "voice_" + randomBytes(16).toString("hex"),
      audio,
      mimeType: "audio/wav",
      durationSeconds: duration,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 300_000).toISOString(),
    });
  }
  async function direct(command) { return auditedClient.send(command); }
  const safeSteps = [];
  function reached(step) { safeSteps.push(step); process.stdout.write(`步骤通过：${step}\n`); }

  try {
    await backend.putLatest(record(fixtureA));
    reached("1/8 私有加密 PUT A");
    const list = await direct(new ListObjectsV2Command({
      Bucket: BUCKET, Prefix: PREFIX, MaxKeys: 3,
    }));
    requireExactly(list?.IsTruncated !== true && list?.Contents?.length === 1 &&
      typeof list.Contents[0]?.Key === "string" &&
      list.Contents[0].Key.startsWith(PREFIX), "unexpected_prefix_inventory");
    const key = list.Contents[0].Key;
    const headA = await direct(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    requireExactly(typeof headA?.ETag === "string" && headA.ETag.length > 2,
      "missing_etag_a");
    reached("2/8 仅本前缀单对象 LIST 与 HEAD A");

    await backend.putLatest(record(fixtureB));
    const headB = await direct(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    requireExactly(typeof headB?.ETag === "string" && headB.ETag.length > 2 &&
      headB.ETag !== headA.ETag, "etag_replacement_unverifiable");
    reached("3/8 私有加密 PUT B 替换，ETag 确实变化");

    // One signed GET of an unrelated synthetic owner key should return no audio.
    const foreign = await backend.getLatest({ principal: otherPrincipal, now: new Date().toISOString() });
    requireExactly(foreign === null, "cross_owner_access_not_rejected");
    reached("4/8 跨 owner 不能读取私有音频");

    // CRITICAL negative proof. SDK sending IfMatch is NOT sufficient.
    let staleFailed = false;
    try {
      await direct(new DeleteObjectCommand({ Bucket: BUCKET, Key: key, IfMatch: headA.ETag }));
    } catch (error) {
      if (isExpectedPreconditionFailed(error)) staleFailed = true;
      else stop("stale_etag_delete_unexpected_result");
    }
    requireExactly(staleFailed, "stale_etag_delete_was_accepted_stop_now");
    reached("5/8 旧 ETag 删除被服务器拒绝（412）");

    const surviving = await backend.getLatest({ principal, now: new Date().toISOString() });
    requireExactly(surviving && surviving.audio.equals(fixtureB),
      "newer_object_not_preserved_after_stale_delete");
    reached("6/8 B 仍存在，owner 解密 WAV 与最新内容一致");

    const deleted = await direct(new DeleteObjectCommand({
      Bucket: BUCKET, Key: key, IfMatch: headB.ETag,
    }));
    requireExactly(statusCode(deleted) === 0 ||
      (statusCode(deleted) >= 200 && statusCode(deleted) < 300),
      "correct_etag_delete_not_confirmed");
    reached("7/8 最新 ETag 条件删除成功");

    const gone = await backend.getLatest({ principal, now: new Date().toISOString() });
    requireExactly(gone === null, "deleted_object_still_readable");
    reached("8/8 对象不可读取");

    requireExactly(totalRequests === 10 && transportRequests === totalRequests &&
      used.PutObjectCommand === 2 &&
      used.GetObjectCommand === 3 && used.HeadObjectCommand === 2 &&
      used.DeleteObjectCommand === 2 && used.ListObjectsV2Command === 1,
      "actual_request_shape_mismatch");
    process.stdout.write("\nQUALIFICATION_PASS (Kodo one-time synthetic object trial)\n");
    process.stdout.write(JSON.stringify({
      result: "PASS", bucket: BUCKET,
      region: "ap-southeast-1", noRealVoice: true,
      conditionalDeleteStaleEtagRejected: true,
      newestObjectSurvived: true,
      correctEtagDeletionVerified: true,
      privateEncryptionRoundTrip: true,
      requestCount: totalRequests, physicalHttpsRequestCount: transportRequests,
      counts: Object.fromEntries(Object.entries(used).map(([k, v]) => [k.replace("Command", ""), v])),
      totalUploadBytes: putBytes,
      getResponseBytes: getBytes,
      durationSeconds: Math.round((Date.now() - since) / 1000),
      realMiniMaxCalls: 0,
      credentialsLogged: false,
    }, null, 2) + "\n");
  } finally {
    realClient.destroy();
    transportOwner.destroy();
    masterKey.fill(0);
    fixtureA.fill(0);
    fixtureB.fill(0);
  }
}

main().catch(error => {
  process.stdout.write("\nQUALIFICATION_STOP：" + summaryError(error) + "\n");
  process.stdout.write("已执行的远程调用不会自动重试；如有剩余合成对象，由 1 天生命周期兜底清理。\n");
  process.stdout.write("不要删除本机一次性锁文件，不要重复运行。\n");
  process.exitCode = 1;
});