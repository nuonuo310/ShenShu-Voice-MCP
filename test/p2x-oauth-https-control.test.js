import test from "node:test";
import assert from "node:assert/strict";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {InMemoryTransport} from "@modelcontextprotocol/sdk/inMemory.js";
import {makeStagingMcpServer} from "../src/staging-authenticated-mcp.js";
async function withClient(enabled,fn){const server=makeStagingMcpServer({verifiedSubject:"verified_subject_123",privateFixtureEnabled:enabled});const client=new Client({name:"oauth-https-control",version:"0.1"});const [a,b]=InMemoryTransport.createLinkedPair();try{await Promise.all([server.connect(a),client.connect(b)]);await fn(client)}finally{await client.close();await server.close()}}
test("control absent by default",async()=>withClient(false,async c=>{assert.ok(!(await c.listTools()).tools.some(t=>t.name==="preview_oauth_hosted_tone_control"))}));
test("control reuses private UI but only public fixed WAV",async()=>withClient(true,async c=>{const tool=(await c.listTools()).tools.find(t=>t.name==="preview_oauth_hosted_tone_control");assert.equal(tool._meta.ui.resourceUri,"ui://shenshu/private-fixture-bubble-v2.html");const r=await c.callTool({name:tool.name,arguments:{}});assert.equal(r.structuredContent.record.source,"hosted-tone");assert.equal(r.structuredContent.record.audioUrl,"https://shenshu-voice-mcp.onrender.com/test-tone.wav");assert.equal(r.structuredContent.record.generated,false);assert.equal("audioBase64" in r.structuredContent.record,false)}));
