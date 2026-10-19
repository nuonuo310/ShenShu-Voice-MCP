import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("inline preview uses CSP-supported data URI rather than blob:", async () => {
  const ui=await readFile(new URL("../ui/mcp-bubble.html",import.meta.url),"utf8");
  assert.match(ui,/data:audio\/wav;base64,/);
  assert.doesNotMatch(ui,/URL\.createObjectURL/);
  assert.ok(ui.includes('raw.slice(0,4)!=="RIFF"'));
  assert.ok(ui.includes('raw.slice(8,12)!=="WAVE"'));
  assert.match(ui,/next\.source==="fixture"/);
});

test("public paid tool remains absent",async()=>{
  const server=await readFile(new URL("../server.js",import.meta.url),"utf8");
  assert.doesNotMatch(server,/registerAppTool\(\s*server,\s*["']speak_shenshu["']/);
});
