import test from "node:test";
import assert from "node:assert/strict";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {InMemoryTransport} from "@modelcontextprotocol/sdk/inMemory.js";
import {makeStagingMcpServer} from "../src/staging-authenticated-mcp.js";
async function check(enabled,fn){const server=makeStagingMcpServer({verifiedSubject:"verified_subject_123",privateFixtureEnabled:enabled});const client=new Client({name:"ui-bridge-probe-test",version:"0.1"});const [a,b]=InMemoryTransport.createLinkedPair();try{await Promise.all([server.connect(a),client.connect(b)]);await fn(client)}finally{await client.close();await server.close()}}
test("bridge probe is absent when fixture gate is off",async()=>check(false,async c=>{assert.ok(!(await c.listTools()).tools.some(t=>t.name==="probe_oauth_ui_bridge"))}));
test("bridge probe is app-only and returns no private data",async()=>check(true,async c=>{const tool=(await c.listTools()).tools.find(t=>t.name==="probe_oauth_ui_bridge");assert.deepEqual(tool._meta.ui.visibility,["app"]);const r=await c.callTool({name:tool.name,arguments:{}});assert.deepEqual(r.structuredContent,{bridge_verified:true,paid_voice_enabled:false,audio_returned:false});assert.deepEqual(r._meta,{shenshuWidgetProbe:{version:1,marker:"widget-meta-fixed-nonsecret-v1"}});assert.ok(!JSON.stringify(r.structuredContent).includes("shenshuWidgetProbe"));assert.ok(!JSON.stringify(r.content).includes("widget-meta-fixed-nonsecret-v1"))}));

test("OAuth UI resource specializes bridge button without modifying public UI",async()=>check(true,async c=>{
 const resource=await c.readResource({uri:"ui://shenshu/private-fixture-bubble-v2.html"});
 const html=resource.contents[0].text;
 assert.ok(html.includes('const isOAuthBubble=true;'));
 assert.ok(html.includes('id="bridge-probe"'));
 assert.ok(html.includes('request("tools/call"'));
 assert.ok(html.includes("组件专用数据："));
 assert.ok(html.includes("未到达（私有音频路径不可用）"));
 assert.ok(html.includes("widget-meta-fixed-nonsecret-v1"));
 const {readFile}=await import("node:fs/promises");
 const publicHtml=await readFile(new URL("../ui/mcp-bubble.html",import.meta.url),"utf8");
 assert.ok(!publicHtml.includes('const isOAuthBubble=true;'));
}));
