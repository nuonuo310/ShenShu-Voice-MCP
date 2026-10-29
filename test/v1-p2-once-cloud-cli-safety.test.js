/**
 * Safety tests for the REAL cloud qualification entrypoints.
 * No credentials or network and no writes to any real cloud service.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const D1=fileURLToPath(new URL("../scripts/qualify-d1-cloud-once.mjs",import.meta.url));
const KODO=fileURLToPath(new URL("../scripts/qualify-kodo-owner-once.mjs",import.meta.url));

test("real cloud CLIs are inert without explicit --run and an interactive TTY",()=>{
  for(const script of [D1,KODO]) {
    const without=spawnSync(process.execPath,[script],{
      encoding:"utf8",stdio:["pipe","pipe","pipe"],timeout:5000,
    });
    assert.equal(without.status,1);
    assert.match(without.stdout,/QUALIFICATION_STOP: explicit_run_flag_required/);
    const piped=spawnSync(process.execPath,[script,"--run"],{
      encoding:"utf8",stdio:["pipe","pipe","pipe"],timeout:5000,
    });
    assert.equal(piped.status,1);
    assert.match(piped.stdout,/QUALIFICATION_STOP: interactive_terminal_required/);
    // Failing before prompts/lock/network does not consume a user's one-shot run.
    assert.doesNotMatch(piped.stdout,/步骤通过|QUALIFICATION_PASS/);
  }
});

test("D1 single-window qualification pins exact database and forbids migration/deletion",async()=>{
  const s=await readFile(D1,"utf8");
  assert.match(s,/234913cd-8901-4607-8147-31c4a4317111/);
  assert.match(s,/c39a6895-7028-4f59-a100-1455b92c96c1/);
  assert.match(s,/max.*36|MAX_HTTP\s*=\s*36/i);
  assert.match(s,/MAX_INSERT\s*=\s*3/);
  assert.match(s,/MAX_CLAIM\s*=\s*5/);
  assert.match(s,/MAX_WRITES\s*=\s*12/);
  assert.match(s,/oneRunLock\(\)/);
  assert.match(s,/createD1P2ConfirmationOperationStore/);
  assert.match(s,/concurrent_claim_not_exactly_one/);
  assert.match(s,/quota_not_rejected/);
  assert.match(s,/atomic_ledger_invariant_failed/);
  assert.match(s,/allowedStatements/);
  assert.doesNotMatch(s,/client\.batch|wrangler d1 execute|\.deleteObject\(/);
});
test("Kodo one-shot script is GET/PUT-only and lifecycle-respecting",async()=>{
  const s=await readFile(KODO,"utf8");
  assert.match(s,/shenshu-voice-v1-sg-20261029/);
  assert.match(s,/MAX_REQUESTS\s*=\s*4/);
  assert.match(s,/MAX_PUT_BYTES\s*=\s*256\*1024/);
  assert.match(s,/MAX_GET_TOTAL\s*=\s*768\*1024/);
  assert.match(s,/used\.PutObjectCommand===1 && used\.GetObjectCommand===3/);
  assert.match(s,/foreign_owner_received_audio/);
  assert.match(s,/expired_audio_still_readable/);
  assert.match(s,/oneShotLock\(\)/);
  assert.doesNotMatch(s,/\b(?:DeleteObjectCommand|HeadObjectCommand|ListObjectsV2Command|IfMatch|presign|Presign)\b/);
});
