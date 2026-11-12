import {test} from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
test("cloud D1 remote probe is dry-run by default with no network",()=>{
  const p=spawnSync(process.execPath,["scripts/d1-remote-concurrency.mjs"],{encoding:"utf8",timeout:5000});
  assert.equal(p.status,0,p.stderr);
  assert.match(p.stdout,/DRY RUN ONLY/);
  assert.match(p.stdout,/no Cloudflare request/);
});
test("remote probe requires explicit opt-in and never invokes paid audio",()=>{
 const s=readFileSync(new URL("../scripts/d1-remote-concurrency.mjs",import.meta.url),"utf8");
 assert.match(s,/--execute-remote/);
 assert.match(s,/--remote/);
 assert.match(s,/D1_RESERVE_SQL/);
 assert.doesNotMatch(s,/minimax|speak_shenshu|MINIMAX_API_KEY/i);
});
