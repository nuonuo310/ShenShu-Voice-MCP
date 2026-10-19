import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const port = 18879;
const child = spawn(process.execPath, ["server.js"], {
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
child.stdout.on("data", x => logs += x.toString());
child.stderr.on("data", x => logs += x.toString());
const base = "http://127.0.0.1:" + port;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  let alive = false;
  for (let i = 0; i < 50; i++) {
    if (child.exitCode !== null) throw new Error("server_exited: " + logs);
    try {
      const r = await fetch(base + "/");
      if (r.ok && (await r.text()).includes("P1-MOCK")) { alive = true; break; }
    } catch {}
    await sleep(120);
  }
  assert.ok(alive, "server did not become healthy: " + logs);
  const initialize = await fetch(base + "/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "smoke-test", version: "1.0.0" },
      },
    }),
  });
  if (initialize.status !== 200) throw new Error("MCP initialize HTTP " + initialize.status + ": " + await initialize.text());
  const data = await initialize.json();
  assert.ok(data.result?.serverInfo, "missing MCP initialize result");
  console.log("MCP HTTP initialize PASS");

  async function rpc(id, method, params = {}) {
    const response = await fetch(base + "/mcp", {
      method:"POST",
      headers:{"content-type":"application/json","accept":"application/json, text/event-stream"},
      body:JSON.stringify({jsonrpc:"2.0",id,method,params}),
    });
    assert.equal(response.status,200,"MCP RPC status "+method);
    return await response.json();
  }
  const listing = await rpc(2,"tools/list");
  const names = listing.result?.tools?.map(x=>x.name) || [];
  assert.ok(names.includes("preview_shenshu_voice"),"existing voice fixture tool missing");
  assert.ok(names.includes("preview_inline_audio"),"inline fixture tool missing");
  assert.ok(!names.includes("speak_shenshu"),"paid tool must remain inaccessible");
  const call = await rpc(3,"tools/call",{name:"preview_inline_audio",arguments:{}});
  assert.equal(call.result?.structuredContent?.record?.source,"tone-fixture");
  const decoded = Buffer.from(call.result.structuredContent.record.audioBase64,"base64");
  assert.equal(decoded.subarray(0,4).toString("ascii"),"RIFF");
  assert.equal(decoded.length,22444);
  console.log("MCP tools/list and inline audio tools/call PASS");

} finally {
  child.kill("SIGTERM");
}
