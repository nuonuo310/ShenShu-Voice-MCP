import test from "node:test";
import assert from "node:assert/strict";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {InMemoryTransport} from "@modelcontextprotocol/sdk/inMemory.js";
import {makeStagingMcpServer} from "../src/staging-authenticated-mcp.js";
async function check(enabled,fn){const server=makeStagingMcpServer({verifiedSubject:"verified_subject_123",privateFixtureEnabled:enabled});const client=new Client({name:"bridge-audio-test",version:"0.1"});const [a,b]=InMemoryTransport.createLinkedPair();try{await Promise.all([server.connect(a),client.connect(b)]);await fn(client)}finally{await client.close();await server.close()}}
test("bridge audio payload absent when private fixture gate off",async()=>check(false,async c=>{assert.ok(!(await c.listTools()).tools.some(t=>t.name==="probe_oauth_bridge_audio_payload"))}));
test("bridge payload is app-only fixed WAV, no URL or paid synthesis",async()=>check(true,async c=>{const tool=(await c.listTools()).tools.find(t=>t.name==="probe_oauth_bridge_audio_payload");assert.deepEqual(tool._meta.ui.visibility,["app"]);const r=await c.callTool({name:tool.name,arguments:{}});const x=r.structuredContent;assert.equal(x.source,"oauth-bridge-tone");assert.equal(x.audioMimeType,"audio/wav");assert.equal(x.generated,false);assert.equal(x.paid_voice_enabled,false);assert.equal("audioUrl" in x,false);const wav=Buffer.from(x.audioBase64,"base64");assert.equal(wav.subarray(0,4).toString(),"RIFF");assert.ok(wav.length<2*1024*1024)}));

test("OAuth resource enables audio inspection while public UI remains gated",async()=>check(true,async c=>{
 const view=await c.readResource({uri:"ui://shenshu/private-fixture-bubble-v1.html"});
 const html=view.contents[0].text;
 assert.ok(html.includes('id="bridge-audio-probe"'));
 assert.ok(html.includes('const isOAuthBubble=true;'));
 assert.ok(html.includes('name:"probe_oauth_bridge_audio_payload"'));
 const {readFile}=await import("node:fs/promises");
 const publicHtml=await readFile(new URL("../ui/mcp-bubble.html",import.meta.url),"utf8");
 assert.ok(!publicHtml.includes('const isOAuthBubble=true;'));
}));
