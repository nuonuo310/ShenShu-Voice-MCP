import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { makeStagingMcpServer } from "../src/staging-authenticated-mcp.js";
import {
  createV1P2NonbillableMcpTools, P2_PREPARE_TOOL, P2_STATUS_TOOL,
} from "../src/v1-p2-nonbillable-mcp.js";

const HANDLE = "h".repeat(43);
const EXPIRES = "2026-10-28T16:00:00.000Z";
const VERIFIED_REQUEST = Object.freeze({
  headers: Object.freeze({authorization: "Bearer signed.header.payload"}),
});

function harness({ invalidStatus = false } = {}) {
  const calls=[];
  const broker={
    async initiate(input) {
      calls.push({action:"initiate",input});
      return {status:"pending_confirmation",handle:HANDLE,expiresAt:EXPIRES,
        billable:false,principal:"never-echo",text:"never-echo",grant:"never-echo"};
    },
    async status(input) {
      calls.push({action:"status",input});
      return invalidStatus
        ? {status:"forged",text:"secret"}
        : {status:"pending_confirmation",expiresAt:EXPIRES,billable:false,
            principal:"never-echo",text:"never-echo",grant:"never-echo"};
    },
    async confirm() { throw Error("confirm_must_never_be_reachable"); },
  };
  return {calls,bridge:createV1P2NonbillableMcpTools({
    broker,verifiedRequest:VERIFIED_REQUEST,
  })};
}

test("nonbillable tools reject unverified or missing bridge dependencies",()=>{
  assert.throws(()=>createV1P2NonbillableMcpTools(),/proposal_bridge_unavailable/);
  assert.throws(()=>createV1P2NonbillableMcpTools({
    broker:{initiate(){},status(){}},verifiedRequest:{headers:{authorization:"Untrusted x"}},
  }),/proposal_bridge_unavailable/);
});

test("only prepare/status exist; preparation does not trust client identity or leak text",async()=>{
  const {bridge,calls}=harness();
  assert.deepEqual(bridge.tools.map(x=>x.name),[P2_PREPARE_TOOL,P2_STATUS_TOOL]);
  assert.ok(bridge.tools.every(x=>x.inputSchema.additionalProperties===false));
  const response=await bridge.call(P2_PREPARE_TOOL,{text:"糯糯，今天也想你。"});
  assert.equal(response.structuredContent.status,"pending_confirmation");
  assert.equal(response.structuredContent.billable,false);
  assert.equal(response.structuredContent.paid_voice_enabled,false);
  assert.equal(response.structuredContent.handle,HANDLE);
  assert.equal(response.structuredContent.text,undefined);
  assert.equal(response.structuredContent.principal,undefined);
  assert.equal(response.structuredContent.grant,undefined);
  assert.equal(calls.length,1);
  assert.equal(calls[0].action,"initiate");
  assert.equal(calls[0].input.text,"糯糯，今天也想你。");
  assert.deepEqual(calls[0].input.trustedRequest,VERIFIED_REQUEST);
  assert.notEqual(calls[0].input.trustedRequest,VERIFIED_REQUEST);
});

test("only owner status lookup is sent to injected broker, with no confirm",async()=>{
  const {bridge,calls}=harness();
  const response=await bridge.call(P2_STATUS_TOOL,{handle:HANDLE});
  assert.deepEqual(response.structuredContent,{
    status:"pending_confirmation",paid_voice_enabled:false,
    expiresAt:EXPIRES,billable:false,
  });
  assert.equal(calls[0].action,"status");
  assert.equal(calls[0].input.handle,HANDLE);
  assert.deepEqual(calls[0].input.trustedRequest,VERIFIED_REQUEST);
  await assert.rejects(bridge.call("confirm_shenshu_voice",{handle:HANDLE}),/unknown_tool/);
  assert.equal(calls.length,1);
});

test("rejects client authority fields, malformed handles and invalid backend results",async()=>{
  const {bridge,calls}=harness();
  await assert.rejects(bridge.call(P2_PREPARE_TOOL,{text:"hi",principal:"attacker"}),/invalid_arguments/);
  await assert.rejects(bridge.call(P2_PREPARE_TOOL,{text:"",handle:HANDLE}),/invalid_arguments/);
  await assert.rejects(bridge.call(P2_STATUS_TOOL,{handle:HANDLE,grant:"fake"}),/invalid_arguments/);
  await assert.rejects(bridge.call(P2_STATUS_TOOL,{handle:"wrong"}),/invalid_arguments/);
  assert.equal(calls.length,0);
  const malformed=harness({invalidStatus:true});
  await assert.rejects(malformed.bridge.call(P2_STATUS_TOOL,{handle:HANDLE}),/proposal_bridge_invalid_result/);
});

async function withClient(makeServer,fn) {
  const [clientSide,serverSide]=InMemoryTransport.createLinkedPair();
  const server=makeServer();
  const client=new Client({name:"p2-bridge-test",version:"0.1.0"});
  try {
    await server.connect(serverSide);
    await client.connect(clientSide);
    return await fn(client);
  } finally {
    await client.close();
    await server.close();
  }
}

test("real MCP tool registry exposes proposals only on explicit injection",async()=>{
  await withClient(()=>makeStagingMcpServer({
    verifiedSubject:"p".repeat(43),
  }),async client=>{
    const tools=await client.listTools();
    assert.ok(!tools.tools.some(x=>x.name===P2_PREPARE_TOOL||x.name===P2_STATUS_TOOL));
  });
  const {bridge,calls}=harness();
  await withClient(()=>makeStagingMcpServer({
    verifiedSubject:"p".repeat(43),proposalTools:bridge,
  }),async client=>{
    const tools=await client.listTools();
    assert.equal(tools.tools.filter(x=>[P2_PREPARE_TOOL,P2_STATUS_TOOL].includes(x.name)).length,2);
    assert.equal(tools.tools.filter(x=>/confirm.*voice|voice.*confirm/.test(x.name)).length,0);
    const response=await client.callTool({name:P2_PREPARE_TOOL,arguments:{text:"今天想你"}});
    assert.equal(response.structuredContent.billable,false);
    assert.equal(response.structuredContent.status,"pending_confirmation");
  });
  assert.equal(calls.length,1);
});
