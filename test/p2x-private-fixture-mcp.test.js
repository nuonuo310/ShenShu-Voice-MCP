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
  const resources=await client.listResources();
  assert.equal(resources.resources.length,0);
}));

test("private fixture tool returns bounded inline nonbillable audio only when enabled",async()=>withClient(true,async client=>{
  const names=(await client.listTools()).tools.map(x=>x.name);
  assert.ok(names.includes("preview_private_fixture"));
  const tool=(await client.listTools()).tools.find(x=>x.name==="preview_private_fixture");
  const uri=tool._meta?.ui?.resourceUri;
  assert.equal(uri,"ui://shenshu/private-fixture-bubble-v1.html");
  const resources=await client.listResources();
  assert.ok(resources.resources.some(x=>x.uri===uri));
  const view=await client.readResource({uri});
  assert.ok(view.contents[0].text.includes("private-fixture"));
  assert.equal(view.contents[0].mimeType,"text/html;profile=mcp-app");
  const result=await client.callTool({name:"preview_private_fixture",arguments:{}});
  assert.equal(result.structuredContent.record.source,"private-fixture");
  assert.equal(result.structuredContent.record.generated,false);
  assert.equal(result.structuredContent.record.audioMimeType,"audio/wav");
  assert.equal("audioUrl" in result.structuredContent.record,false);
  assert.ok(result.structuredContent.record.audioBase64.length>100);
}));
