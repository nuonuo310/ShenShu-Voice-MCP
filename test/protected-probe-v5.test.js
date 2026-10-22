import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { generateKeyPairSync, sign } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { readFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  handleStagingAuthenticatedMcp,
  makeStagingMcpServer,
} from "../src/staging-authenticated-mcp.js";
import { makeInlineToneFixture } from "../src/inline-fixture.js";
import {
  NONBILLABLE_GENERATED_TEST_LABEL,
  PROPOSED_GENERATED_HOST_TOOL_NAME,
} from "../src/generated-host-delivery-candidate.js";

const OAUTH_UI_URI = "ui://shenshu/private-fixture-bubble-v2.html";
const TEST_ISSUER = "https://offline.invalid/";
const TEST_AUDIENCE = "https://offline.invalid/paid-mcp";
const fixture = makeInlineToneFixture();
const fixtureBytes = Buffer.from(fixture.audioBase64, "base64");
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const TEST_JWK = {
  ...publicKey.export({ format: "jwk" }),
  alg: "RS256",
  use: "sig",
  kid: "v5-protected-probe-key",
};

function accessToken({ scope = "voice:speak", expiry = 300, audience = TEST_AUDIENCE } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({
    alg: "RS256",
    typ: "JWT",
    kid: TEST_JWK.kid,
  })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: TEST_ISSUER,
    aud: audience,
    sub: "fixture-v5-user",
    scope,
    iat: now - 10,
    exp: now + expiry,
  })).toString("base64url");
  const message = header + "." + payload;
  return message + "." + sign("RSA-SHA256", Buffer.from(message), privateKey).toString("base64url");
}

async function withStagingClient(enabled, fn) {
  const server = makeStagingMcpServer({
    verifiedSubject: "verified_subject_123",
    privateFixtureEnabled: enabled,
  });
  const client = new Client({ name: "protected-probe-v5", version: "0.1.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([server.connect(a), client.connect(b)]);
    return await fn(client);
  } finally {
    await client.close();
    await server.close();
  }
}

async function readOAuthSurface() {
  return withStagingClient(true, async (client) => {
    const tools = await client.listTools();
    const resource = await client.readResource({ uri: OAUTH_UI_URI });
    const fixed = await client.callTool({
      name: "probe_oauth_bridge_audio_payload",
      arguments: {},
    });
    const generated = await client.callTool({
      name: PROPOSED_GENERATED_HOST_TOOL_NAME,
      arguments: {},
    });
    return {
      tools: tools.tools,
      html: resource.contents[0].text,
      resource: resource.contents[0],
      fixed: fixed.structuredContent,
      generated,
    };
  });
}

async function startAuthenticatedMcp() {
  const env = {
    SHENSHU_AUTH_MCP_ENABLED: "1",
    SHENSHU_AUTH_STATIC_JWKS_TEST_ONLY: "1",
    SHENSHU_AUTH_PUBLIC_JWKS_JSON: JSON.stringify({ keys: [TEST_JWK] }),
    SHENSHU_PRIVATE_FIXTURE_ENABLED: "1",
  };
  const httpServer = createHttpServer(async (req, res) => {
    try {
      await handleStagingAuthenticatedMcp(req, res, {
        env,
        issuer: TEST_ISSUER,
        audience: TEST_AUDIENCE,
        resourceMetadataUrl:
          "https://offline.invalid/.well-known/oauth-protected-resource/paid-mcp",
      });
    } catch {
      if (!res.headersSent) res.writeHead(500).end("internal_error");
    }
  });
  await new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(0, "127.0.0.1", resolve);
  });
  const { port } = httpServer.address();
  const endpoint = `http://127.0.0.1:${port}/paid-mcp`;

  async function rpc(body, tokenValue) {
    const headers = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    };
    if (tokenValue) headers.authorization = "Bearer " + tokenValue;
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: response.status, text, json };
  }

  return {
    rpc,
    async close() {
      if (typeof httpServer.closeAllConnections === "function") {
        httpServer.closeAllConnections();
      }
      await new Promise((resolve) => httpServer.close(resolve));
    },
  };
}

test("generated host probe is absent when the private fixture gate is off", async () => {
  await withStagingClient(false, async (client) => {
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    assert.ok(names.includes("verify_shenshu_login"));
    assert.equal(names.includes(PROPOSED_GENERATED_HOST_TOOL_NAME), false);
  });
});

test("protected server construction requires a verified subject", () => {
  assert.throws(
    () => makeStagingMcpServer({ privateFixtureEnabled: true }),
    /missing_verified_subject/,
  );
});

test("authenticated tool list exposes one app-only OAuth generated probe", async () => {
  const surface = await readOAuthSurface();
  const tool = surface.tools.find((entry) => entry.name === PROPOSED_GENERATED_HOST_TOOL_NAME);

  assert.ok(tool);
  assert.deepEqual(tool._meta.ui.visibility, ["app"]);
  assert.equal(tool._meta.ui.resourceUri, undefined);
  assert.deepEqual(tool._meta.securitySchemes, [{ type: "oauth2", scopes: ["voice:speak"] }]);
  assert.deepEqual(tool.inputSchema, {
    type: "object",
    properties: {},
    additionalProperties: false,
  });
  assert.equal(surface.tools.filter((entry) => entry.name === tool.name).length, 1);
});

test("generated host probe rejects every nonempty invocation argument", async () => {
  await withStagingClient(true, async (client) => {
    await assert.rejects(
      client.callTool({
        name: PROPOSED_GENERATED_HOST_TOOL_NAME,
        arguments: { text: "caller supplied text is forbidden" },
      }),
      /invalid_arguments/,
    );
    await assert.rejects(
      client.callTool({
        name: PROPOSED_GENERATED_HOST_TOOL_NAME,
        arguments: { unexpected: true },
      }),
      /invalid_arguments/,
    );
  });
});

test("registered tool returns only the exact fixed nonbillable generated-shape record", async () => {
  const surface = await readOAuthSurface();
  const result = surface.generated;
  const record = result.structuredContent.record;

  assert.deepEqual(Object.keys(record).sort(), [
    "audioBase64",
    "audioMimeType",
    "billable",
    "durationSeconds",
    "generated",
    "hostDeliveryTest",
    "id",
    "providerInvoked",
    "source",
    "text",
    "title",
    "voiceLabel",
  ]);
  assert.equal(record.id, "host_delivery_fake_generated_001");
  assert.equal(record.source, "minimax");
  assert.equal(record.generated, true);
  assert.equal(record.hostDeliveryTest, true);
  assert.equal(record.providerInvoked, false);
  assert.equal(record.billable, false);
  assert.equal(record.voiceLabel, NONBILLABLE_GENERATED_TEST_LABEL);
  assert.match(record.title, /NONBILLABLE TEST/);
  assert.match(record.text, /NONBILLABLE TEST/);
  assert.equal(record.audioMimeType, "audio/wav");
  assert.equal(record.durationSeconds, fixture.durationSeconds);
  assert.equal(record.audioBase64, fixture.audioBase64);
  assert.deepEqual(Buffer.from(record.audioBase64, "base64"), fixtureBytes);
  assert.equal("audioUrl" in record, false);
  assert.doesNotMatch(JSON.stringify(result), /audioUrl|https?:/i);
  assert.match(result.content[0].text, /NONBILLABLE TEST/);
  assert.match(result.content[0].text, /no MiniMax call or D1 access/);
});

test("missing and invalid OAuth fail before any generated fixture is emitted", async () => {
  const gate = await startAuthenticatedMcp();
  const callBody = (id) => ({
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name: PROPOSED_GENERATED_HOST_TOOL_NAME, arguments: {} },
  });
  try {
    const missing = await gate.rpc(callBody(1));
    assert.equal(missing.status, 401);
    assert.doesNotMatch(missing.text, /host_delivery_fake_generated_001|audioBase64|structuredContent/);

    const invalid = await gate.rpc(callBody(2), "fake.jwt.signature");
    assert.equal(invalid.status, 401);
    assert.doesNotMatch(invalid.text, /host_delivery_fake_generated_001|audioBase64|structuredContent/);

    const wrongScope = await gate.rpc(callBody(3), accessToken({ scope: "openid" }));
    assert.equal(wrongScope.status, 403);
    assert.doesNotMatch(wrongScope.text, /host_delivery_fake_generated_001|audioBase64|structuredContent/);

    const wrongAudience = await gate.rpc(
      callBody(4),
      accessToken({ audience: "https://offline.invalid/other-mcp" }),
    );
    assert.equal(wrongAudience.status, 401);
    assert.doesNotMatch(wrongAudience.text, /host_delivery_fake_generated_001|audioBase64|structuredContent/);

    const expired = await gate.rpc(callBody(5), accessToken({ expiry: -1 }));
    assert.equal(expired.status, 401);
    assert.doesNotMatch(expired.text, /host_delivery_fake_generated_001|audioBase64|structuredContent/);

    const valid = accessToken();
    const init = await gate.rpc({
      jsonrpc: "2.0",
      id: 6,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "v5-protected-probe", version: "1.0" },
      },
    }, valid);
    assert.equal(init.status, 200);
    const listed = await gate.rpc({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/list",
      params: {},
    }, valid);
    assert.equal(listed.status, 200);
    const descriptor = listed.json.result.tools.find(
      (tool) => tool.name === PROPOSED_GENERATED_HOST_TOOL_NAME,
    );
    assert.ok(descriptor);
    assert.deepEqual(descriptor.securitySchemes, [
      { type: "oauth2", scopes: ["voice:speak"] },
    ]);
    assert.deepEqual(descriptor._meta.ui.visibility, ["app"]);
    const invoked = await gate.rpc(callBody(8), valid);
    assert.equal(invoked.status, 200);
    assert.equal(
      invoked.json.result.structuredContent.record.id,
      "host_delivery_fake_generated_001",
    );
  } finally {
    await gate.close();
  }
});

function fakeClassList() {
  const values = new Set();
  return {
    toggle(name, force) {
      if (force === undefined) {
        if (values.has(name)) values.delete(name);
        else values.add(name);
      } else if (force) values.add(name);
      else values.delete(name);
      return values.has(name);
    },
  };
}

function fakeElement(id) {
  const attributes = {};
  const listeners = {};
  return {
    id,
    textContent: "",
    innerHTML: "",
    disabled: false,
    hidden: id.endsWith("-probe"),
    dataset: {},
    classList: fakeClassList(),
    listeners,
    addEventListener(type, listener) { listeners[type] = listener; },
    setAttribute(name, value) { attributes[name] = String(value); },
    getAttribute(name) { return attributes[name] ?? null; },
    removeAttribute(name) { delete attributes[name]; },
  };
}

function makeUiHarness(html, href, { contextStateAfterResume = "running" } = {}) {
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  const ids = [
    "wave", "audio", "play", "text", "status", "duration", "capability", "audio-output-diagnostic",
    "bridge-probe", "bridge-result", "bridge-audio-probe", "bridge-audio-result",
    "bridge-decode-probe", "bridge-decode-result", "bridge-play-probe", "bridge-play-result",
    "bridge-generated-probe", "bridge-generated-result",
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, fakeElement(id)]));
  const waveBars = Array.from({ length: 32 }, () => ({ classList: fakeClassList() }));
  elements.wave.querySelectorAll = (selector) => selector === "i" ? waveBars : [];

  const audio = elements.audio;
  let audioSrc = "";
  audio.paused = true;
  audio.duration = Number.NaN;
  audio.currentTime = 0;
  audio.error = null;
  audio.readyState = 0;
  audio.playCalls = 0;
  audio.loadCalls = 0;
  audio.canPlayType = () => "probably";
  Object.defineProperty(audio, "src", {
    get() { return audioSrc; },
    set(value) { audioSrc = String(value); audio.setAttribute("src", audioSrc); },
  });
  const removeAttribute = audio.removeAttribute;
  audio.removeAttribute = (name) => {
    if (name === "src") audioSrc = "";
    removeAttribute(name);
  };
  audio.pause = () => { audio.paused = true; };
  audio.play = async () => { audio.playCalls++; audio.paused = false; };
  audio.load = () => { audio.loadCalls++; };

  const contexts = [];
  class FakeAudioContext {
    constructor() {
      this.state = "suspended";
      this.currentTime = 0;
      this.resumeCalls = 0;
      this.closeCalls = 0;
      this.decodedInputs = [];
      this.sources = [];
      this.destination = {};
      contexts.push(this);
    }
    resume() { this.resumeCalls++; this.state = contextStateAfterResume; return Promise.resolve(); }
    async decodeAudioData(buffer) {
      this.decodedInputs.push(Buffer.from(buffer));
      return { duration: fixture.durationSeconds, sampleRate: 16000, numberOfChannels: 1 };
    }
    createBufferSource() {
      const node = {
        buffer: null,
        onended: null,
        startCalls: 0,
        connectCalls: 0,
        connect() { this.connectCalls++; },
        start() { this.startCalls++; },
        stop() {},
        disconnect() {},
      };
      this.sources.push(node);
      return node;
    }
    close() { this.closeCalls++; return Promise.resolve(); }
  }

  const messageListeners = [];
  const posted = [];
  const parent = { postMessage(message) { posted.push(message); } };
  const window = {
    location: { href },
    parent,
    AudioContext: FakeAudioContext,
    webkitAudioContext: undefined,
    addEventListener(type, listener) {
      if (type === "message") messageListeners.push(listener);
    },
  };
  const document = { getElementById(id) { return elements[id] ?? null; } };
  vm.runInNewContext(script, {
    window,
    document,
    atob,
    btoa,
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    console,
  });

  function emit(message) {
    for (const listener of messageListeners) listener({ source: parent, data: message });
  }
  function click(id) {
    const listener = elements[id].listeners.click;
    assert.equal(typeof listener, "function");
    return listener();
  }
  function findToolCall(name) {
    return posted.find((message) =>
      message.method === "tools/call" && message.params?.name === name
    );
  }
  function resolveRpc(id, result) {
    emit({ jsonrpc: "2.0", id, result });
  }

  return { elements, audio, contexts, posted, click, findToolCall, resolveRpc };
}

test("OAuth-only UI button posts tools/call and reaches gesture-gated Web Audio", async () => {
  const surface = await readOAuthSurface();
  const harness = makeUiHarness(
    surface.html,
    "https://host.invalid/ui/private-fixture-bubble-v2.html",
  );
  assert.equal(harness.elements["bridge-generated-probe"].hidden, false);
  assert.equal(harness.contexts.length, 0);

  const clicked = harness.click("bridge-generated-probe");
  const call = harness.findToolCall(PROPOSED_GENERATED_HOST_TOOL_NAME);
  assert.ok(call);
  assert.deepEqual(JSON.parse(JSON.stringify(call.params)), {
    name: PROPOSED_GENERATED_HOST_TOOL_NAME,
    arguments: {},
  });
  assert.equal(harness.contexts.length, 0);
  harness.resolveRpc(call.id, surface.generated);
  await clicked;

  assert.equal(harness.contexts.length, 0);
  assert.equal(harness.audio.src, "");
  assert.equal(harness.audio.loadCalls, 0);
  assert.match(harness.elements.text.textContent, /NONBILLABLE TEST/);
  assert.match(harness.elements.status.textContent, /非计费测试/);
  assert.match(harness.elements["bridge-generated-result"].textContent, /已交付/);
  assert.equal(harness.elements.play.disabled, false);

  await harness.click("play");

  assert.equal(harness.contexts.length, 1);
  assert.equal(harness.contexts[0].resumeCalls, 1);
  assert.equal(harness.contexts[0].decodedInputs.length, 1);
  assert.deepEqual(harness.contexts[0].decodedInputs[0], fixtureBytes);
  assert.equal(harness.contexts[0].sources.length, 1);
  assert.equal(harness.contexts[0].sources[0].startCalls, 1);
  assert.equal(harness.audio.src, "");
  assert.equal(harness.audio.loadCalls, 0);
  assert.equal(harness.audio.playCalls, 0);
  assert.match(harness.elements.status.textContent, /非计费测试/);
  assert.match(harness.elements.status.textContent, /MiniMax/);
});

test("OAuth generated button rejects inconsistent results without a success label", async () => {
  const surface = await readOAuthSurface();
  const harness = makeUiHarness(
    surface.html,
    "https://host.invalid/ui/private-fixture-bubble-v2.html",
  );
  const invalid = {
    ...surface.generated,
    structuredContent: {
      record: {
        ...surface.generated.structuredContent.record,
        providerInvoked: true,
      },
    },
  };

  const clicked = harness.click("bridge-generated-probe");
  const call = harness.findToolCall(PROPOSED_GENERATED_HOST_TOOL_NAME);
  assert.ok(call);
  harness.resolveRpc(call.id, invalid);
  await clicked;

  assert.equal(harness.contexts.length, 0);
  assert.equal(harness.audio.src, "");
  assert.equal(harness.audio.loadCalls, 0);
  assert.match(harness.elements["bridge-generated-result"].textContent, /交付失败/);
  assert.doesNotMatch(harness.elements["bridge-generated-result"].textContent, /已交付/);
  assert.doesNotMatch(harness.elements.status.textContent, /非计费测试/);
});

test("public UI hides and inertly rejects the protected generated button", async () => {
  const publicHtml = await readFile(new URL("../ui/mcp-bubble.html", import.meta.url), "utf8");
  assert.doesNotMatch(publicHtml, /const isOAuthBubble=true;/);
  assert.match(publicHtml, /id="bridge-generated-probe" type="button" hidden/);
  const harness = makeUiHarness(publicHtml, "https://host.invalid/ui/voice-bubble-v1.html");
  assert.equal(harness.elements["bridge-generated-probe"].hidden, true);
  await harness.click("bridge-generated-probe");
  assert.equal(harness.findToolCall(PROPOSED_GENERATED_HOST_TOOL_NAME), undefined);
  assert.equal(harness.contexts.length, 0);
  assert.equal(harness.elements["bridge-generated-result"].textContent, "");
});

test("legacy fixed bridge reports direct-gesture diagnostics and fails closed when iOS interrupts", async () => {
  const surface = await readOAuthSurface();
  const healthy = makeUiHarness(
    surface.html,
    "https://host.invalid/ui/private-fixture-bubble-v2.html",
  );
  const clicked = healthy.click("bridge-play-probe");
  const call = healthy.findToolCall("probe_oauth_bridge_audio_payload");
  assert.ok(call);
  healthy.resolveRpc(call.id, { structuredContent: surface.fixed });
  await clicked;
  assert.equal(healthy.contexts.length, 1);
  assert.equal(healthy.contexts[0].sources.length, 1);
  assert.equal(healthy.contexts[0].sources[0].startCalls, 1);
  assert.match(healthy.elements["audio-output-diagnostic"].textContent, /路径 web-audio-fixed-bridge/);
  assert.match(healthy.elements["audio-output-diagnostic"].textContent, /手势 direct-click/);

  const interrupted = makeUiHarness(
    surface.html,
    "https://host.invalid/ui/private-fixture-bubble-v2.html",
    { contextStateAfterResume: "interrupted" },
  );
  const blocked = interrupted.click("bridge-play-probe");
  const blockedCall = interrupted.findToolCall("probe_oauth_bridge_audio_payload");
  interrupted.resolveRpc(blockedCall.id, { structuredContent: surface.fixed });
  await blocked;
  assert.equal(interrupted.contexts[0].decodedInputs.length, 0);
  assert.equal(interrupted.contexts[0].sources.length, 0);
  assert.match(interrupted.elements["bridge-play-result"].textContent, /上下文未运行/);
  assert.match(interrupted.elements["audio-output-diagnostic"].textContent, /ctx interrupted/);
});

test("legacy fixed bridge, private fixture and hosted tone remain unchanged", async () => {
  await withStagingClient(true, async (client) => {
    const fixed = await client.callTool({
      name: "probe_oauth_bridge_audio_payload",
      arguments: {},
    });
    assert.equal(fixed.structuredContent.source, "oauth-bridge-tone");
    assert.equal(fixed.structuredContent.generated, false);
    assert.equal(fixed.structuredContent.paid_voice_enabled, false);
    assert.equal("audioUrl" in fixed.structuredContent, false);
    assert.deepEqual(
      Buffer.from(fixed.structuredContent.audioBase64, "base64"),
      fixtureBytes,
    );

    const privateFixture = await client.callTool({
      name: "preview_private_fixture",
      arguments: {},
    });
    assert.equal(privateFixture.structuredContent.record.source, "private-fixture");
    assert.equal(privateFixture.structuredContent.record.generated, false);
    assert.equal("audioUrl" in privateFixture.structuredContent.record, false);

    const hosted = await client.callTool({
      name: "preview_oauth_hosted_tone_control",
      arguments: {},
    });
    assert.equal(hosted.structuredContent.record.source, "hosted-tone");
    assert.equal(hosted.structuredContent.record.generated, false);
    assert.equal(
      hosted.structuredContent.record.audioUrl,
      "https://shenshu-voice-mcp.onrender.com/test-tone.wav",
    );
    assert.equal("audioBase64" in hosted.structuredContent.record, false);
  });

  const staging = await readFile(
    new URL("../src/staging-authenticated-mcp.js", import.meta.url),
    "utf8",
  );
  assert.match(staging, /connectDomains:\s*\[\]/);
  assert.match(
    staging,
    /resourceDomains:\s*\["https:\/\/shenshu-voice-mcp\.onrender\.com"\]/,
  );
  assert.match(staging, /ui:\/\/shenshu\/private-fixture-bubble-v2\.html/);
});

test("public server and fixture helper have no paid, provider or D1 dependency", async () => {
  const [publicServer, staging, candidate] = await Promise.all([
    readFile(new URL("../server.js", import.meta.url), "utf8"),
    readFile(new URL("../src/staging-authenticated-mcp.js", import.meta.url), "utf8"),
    readFile(new URL("../src/generated-host-delivery-candidate.js", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(
    publicServer,
    /generated-host-delivery-candidate|probe_oauth_generated_delivery/,
  );
  assert.match(staging, /makeNonbillableGeneratedHostToolResult/);
  assert.match(staging, /PROPOSED_GENERATED_HOST_TOOL_NAME/);
  assert.doesNotMatch(candidate, /from\s+"[^"]*(?:minimax|paid|d1|auth|budget)/i);
  assert.doesNotMatch(candidate, /\bfetch\s*\(|process\.env|https?:\/\//i);
  assert.match(candidate, /makeInlineToneFixture/);
});

test("public MCP composition never lists the protected generated probe", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  let publicServer;
  let client;
  try {
    const module = await import("../server.js");
    publicServer = module.createShenShuServer();
    client = new Client({ name: "v5-public-composition", version: "0.1.0" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([publicServer.connect(a), client.connect(b)]);
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    assert.ok(names.includes("preview_shenshu_voice"));
    assert.equal(names.includes(PROPOSED_GENERATED_HOST_TOOL_NAME), false);
    assert.equal(names.includes("probe_oauth_bridge_audio_payload"), false);
  } finally {
    if (client) await client.close();
    if (publicServer) await publicServer.close();
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});
