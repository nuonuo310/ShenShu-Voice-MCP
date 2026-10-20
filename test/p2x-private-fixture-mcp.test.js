import test from "node:test";
import assert from "node:assert/strict";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {InMemoryTransport} from "@modelcontextprotocol/sdk/inMemory.js";
import {makeStagingMcpServer} from "../src/staging-authenticated-mcp.js";

async function withClient(enabled, fn) {
  const server=makeStagingMcpServer({verifiedSubject:"verified_subject_123",privateFixtureEnabled:enabled});
  const client=new Client({name:"p2x-fixture-test",version:"0.1.0"});
  const [a,b]=InMemoryTransport.createLinkedPair();
  try {await Promise.all([server.connect(a),client.connect(b)]);await fn(client)}
  finally {await client.close();await server.close()}
}

test("private fixture tool absent by default",async()=>withClient(false,async client=>{
  const names=(await client.listTools()).tools.map(x=>x.name);
  assert.ok(names.includes("verify_shenshu_login"));
  assert.ok(!names.includes("preview_private_fixture"));
}));

test("private fixture tool returns bounded inline nonbillable audio only when enabled",async()=>withClient(true,async client=>{
  const names=(await client.listTools()).tools.map(x=>x.name);
  assert.ok(names.includes("preview_private_fixture"));
  const result=await client.callTool({name:"preview_private_fixture",arguments:{}});
  assert.equal(result.structuredContent.record.source,"private-fixture");
  assert.equal(result.structuredContent.record.generated,false);
  assert.equal(result.structuredContent.record.audioMimeType,"audio/wav");
  assert.equal("audioUrl" in result.structuredContent.record,false);
  assert.ok(result.structuredContent.record.audioBase64.length>100);
}));
