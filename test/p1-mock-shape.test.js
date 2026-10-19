import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("P1 mock exposes MCP Apps tool/resource without MiniMax generation", async () => {
  const server = await readFile(new URL("../server.js", import.meta.url), "utf8");
  assert.match(server, /preview_shenshu_voice/);
  assert.match(server, /ui:\/\/shenshu\/voice-bubble-v1\.html/);
  assert.match(server, /registerAppTool/);
  assert.match(server, /registerAppResource/);
  assert.match(server, /source: "fixture"/);
  assert.doesNotMatch(server, /api\.minimaxi\.com/);
  assert.doesNotMatch(server, /MINIMAX_API_KEY/);
});

test("MCP bubble listens to standard tool-result notification", async () => {
  const html = await readFile(new URL("../ui/mcp-bubble.html", import.meta.url), "utf8");
  assert.match(html, /ui\/initialize/);
  assert.match(html, /ui\/notifications\/initialized/);
  assert.match(html, /ui\/notifications\/tool-result/);
  assert.match(html, /structuredContent\?\.record/);
  assert.match(html, /playsinline/);
});
