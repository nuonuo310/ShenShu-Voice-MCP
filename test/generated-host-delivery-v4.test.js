import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { makeStagingMcpServer } from "../src/staging-authenticated-mcp.js";
import { makeInlineToneFixture } from "../src/inline-fixture.js";
import { prepareGeneratedWebAudioBridge } from "../src/generated-audio-playback-contract.js";
import {
  NONBILLABLE_GENERATED_TEST_LABEL,
  PROPOSED_GENERATED_HOST_TOOL_NAME,
  makeNonbillableGeneratedHostRecord,
  makeNonbillableGeneratedHostToolResult,
  makeMcpAppsToolResultNotification,
} from "../src/generated-host-delivery-candidate.js";

const fixture = makeInlineToneFixture();
const fixtureBytes = Buffer.from(fixture.audioBase64, "base64");
const OAUTH_UI_URI = "ui://shenshu/private-fixture-bubble-v2.html";

function fakeClassList() {
  const values = new Set();
  return {
    toggle(name, force) {
      if (force === undefined) {
        if (values.has(name)) values.delete(name);
        else values.add(name);
      } else if (force) {
        values.add(name);
      } else {
        values.delete(name);
      }
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
    hidden: false,
    dataset: {},
    classList: fakeClassList(),
    listeners,
    addEventListener(type, listener) { listeners[type] = listener; },
    setAttribute(name, value) { attributes[name] = String(value); },
    getAttribute(name) { return attributes[name] ?? null; },
    removeAttribute(name) { delete attributes[name]; },
  };
}

async function readOAuthSurface() {
  const server = makeStagingMcpServer({
    verifiedSubject: "verified_subject_123",
    privateFixtureEnabled: true,
  });
  const client = new Client({ name: "v4-oauth-surface-test", version: "0.1.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([server.connect(a), client.connect(b)]);
    const tools = await client.listTools();
    const resource = await client.readResource({ uri: OAUTH_UI_URI });
    const probe = await client.callTool({
      name: "probe_oauth_bridge_audio_payload",
      arguments: {},
    });
    return {
      toolNames: tools.tools.map((tool) => tool.name),
      html: resource.contents[0].text,
      probe: probe.structuredContent,
    };
  } finally {
    await client.close();
    await server.close();
  }
}

function makeHarness(html) {
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  const ids = [
    "wave", "audio", "play", "text", "status", "duration", "capability",
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
      this.resumeCalls = 0;
      this.closeCalls = 0;
      this.decodedInputs = [];
      this.sources = [];
      this.destination = {};
      contexts.push(this);
    }
    resume() { this.resumeCalls++; return Promise.resolve(); }
    async decodeAudioData(buffer) {
      this.decodedInputs.push(Buffer.from(buffer));
      return { duration: fixture.durationSeconds };
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
  const parent = { postMessage() {} };
  const window = {
    location: { href: "https://host.invalid/ui/private-fixture-bubble-v2.html" },
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

  function dispatchNotification(notification) {
    assert.ok(messageListeners.length > 0);
    for (const listener of messageListeners) {
      listener({ source: parent, data: notification });
    }
  }

  async function clickPlay() {
    const listener = elements.play.listeners.click;
    assert.equal(typeof listener, "function");
    return listener();
  }

  return { elements, audio, contexts, dispatchNotification, clickPlay };
}

test("local generated-shape record is bounded and explicitly nonbillable", () => {
  const result = makeNonbillableGeneratedHostToolResult();
  const record = result.structuredContent.record;
  const prepared = prepareGeneratedWebAudioBridge(record);

  assert.equal(record.source, "minimax");
  assert.equal(record.generated, true);
  assert.equal(record.hostDeliveryTest, true);
  assert.equal(record.providerInvoked, false);
  assert.equal(record.billable, false);
  assert.equal(record.voiceLabel, NONBILLABLE_GENERATED_TEST_LABEL);
  assert.match(record.title, /NONBILLABLE TEST/);
  assert.match(record.text, /NONBILLABLE TEST/);
  assert.equal("audioUrl" in record, false);
  assert.equal(Object.isFrozen(record), true);
  assert.deepEqual(Buffer.from(prepared.audioBytes), fixtureBytes);

  const notification = makeMcpAppsToolResultNotification(result);
  assert.equal(notification.jsonrpc, "2.0");
  assert.equal(notification.method, "ui/notifications/tool-result");
  assert.equal(notification.params, result);
  assert.equal(notification.params.structuredContent.record, record);
  assert.doesNotMatch(JSON.stringify(notification), /audioUrl|https?:/i);
});

test("OAuth surface registers the approved generated host probe and keeps the legacy fixed probe", async () => {
  const surface = await readOAuthSurface();

  assert.ok(surface.toolNames.includes("probe_oauth_bridge_audio_payload"));
  assert.equal(surface.toolNames.includes(PROPOSED_GENERATED_HOST_TOOL_NAME), true);
  assert.equal(surface.probe.source, "oauth-bridge-tone");
  assert.equal(surface.probe.generated, false);
  assert.equal(surface.probe.paid_voice_enabled, false);
  assert.equal("audioUrl" in surface.probe, false);
  assert.match(surface.html, /const isOAuthBubble=true;/);
  assert.match(surface.html, /if\(next\.source==="minimax"\)/);
  assert.match(surface.html, /hostDeliveryTest===true/);
  assert.match(surface.html, /next\.source==="private-fixture"/);
  assert.equal(surface.html.includes(PROPOSED_GENERATED_HOST_TOOL_NAME), true);
  assert.match(surface.html, /id="bridge-generated-probe"/);
});

test("actual OAuth UI resource accepts fake-host generated notification and plays only after click", async () => {
  const { html } = await readOAuthSurface();
  const harness = makeHarness(html);
  const notification = makeMcpAppsToolResultNotification();

  assert.equal(harness.contexts.length, 0);
  harness.dispatchNotification(notification);

  assert.equal(harness.contexts.length, 0);
  assert.equal(harness.audio.src, "");
  assert.equal(harness.audio.loadCalls, 0);
  assert.match(harness.elements.text.textContent, /NONBILLABLE TEST/);
  assert.match(harness.elements.status.textContent, /非计费测试/);
  assert.match(harness.elements.status.textContent, /Web Audio/);
  assert.equal(harness.elements.play.disabled, false);

  await harness.clickPlay();

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

test("tool-result framing rejects missing nonbillable markers or URL-bearing records", () => {
  const result = makeNonbillableGeneratedHostToolResult();
  const record = result.structuredContent.record;
  const unmarked = {
    ...result,
    structuredContent: { record: { ...record, hostDeliveryTest: false } },
  };
  assert.throws(
    () => makeMcpAppsToolResultNotification(unmarked),
    /invalid_nonbillable_generated_test/,
  );

  const withUrl = {
    ...result,
    structuredContent: { record: { ...record, audioUrl: "https://example.invalid/x.wav" } },
  };
  assert.throws(
    () => makeMcpAppsToolResultNotification(withUrl),
    /invalid_generated_audio/,
  );
});

test("OAuth UI rejects inconsistent NONBILLABLE markers without fallback", async () => {
  const { html } = await readOAuthSurface();
  const harness = makeHarness(html);
  const record = makeNonbillableGeneratedHostRecord();
  harness.dispatchNotification({
    jsonrpc: "2.0",
    method: "ui/notifications/tool-result",
    params: {
      structuredContent: {
        record: { ...record, hostDeliveryTest: true, providerInvoked: true },
      },
    },
  });

  assert.equal(harness.contexts.length, 0);
  assert.equal(harness.audio.src, "");
  assert.equal(harness.audio.loadCalls, 0);
  assert.equal(harness.elements.play.disabled, true);
  assert.match(harness.elements.status.textContent, /已拒绝播放/);
});
