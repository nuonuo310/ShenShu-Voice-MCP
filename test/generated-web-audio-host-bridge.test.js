import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { makeInlineToneFixture } from "../src/inline-fixture.js";

const fixture = makeInlineToneFixture();
const fixtureBytes = Buffer.from(fixture.audioBase64, "base64");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

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
    contains(name) { return values.has(name); },
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

async function createHarness({
  contextAvailable = true,
  initialContextState = "running",
  contextStateAfterResume = "running",
  resumeError = null,
  startError = null,
  ios = false,
} = {}) {
  const html = await readFile(new URL("../ui/mcp-bubble.html", import.meta.url), "utf8");
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
  let audioPaused = true;
  audio.paused = true;
  audio.duration = Number.NaN;
  audio.currentTime = 0;
  audio.error = null;
  audio.readyState = 0;
  audio.playCalls = 0;
  audio.pauseCalls = 0;
  audio.loadCalls = 0;
  audio.canPlayType = () => "probably";
  Object.defineProperty(audio, "src", {
    get() { return audioSrc; },
    set(value) { audioSrc = String(value); audio.setAttribute("src", audioSrc); },
  });
  const baseRemoveAttribute = audio.removeAttribute;
  audio.removeAttribute = (name) => {
    if (name === "src") audioSrc = "";
    baseRemoveAttribute(name);
  };
  audio.pause = () => { audio.pauseCalls++; audioPaused = true; audio.paused = true; };
  audio.play = async () => { audio.playCalls++; audioPaused = false; audio.paused = false; };
  audio.load = () => { audio.loadCalls++; };

  const contexts = [];
  let decodeDuration = fixture.durationSeconds;
  let decodeError = null;
  let decodeGate = null;

  class FakeAudioContext {
    constructor() {
      this.state = initialContextState;
      this.currentTime = 0;
      this.sampleRate = 48000;
      this.resumeCalls = 0;
      this.closeCalls = 0;
      this.sources = [];
      this.decodedInputs = [];
      this.destination = {};
      contexts.push(this);
    }
    resume() {
      this.resumeCalls++;
      if (resumeError) return Promise.reject(resumeError);
      this.state = contextStateAfterResume;
      return Promise.resolve();
    }
    async decodeAudioData(buffer) {
      this.decodedInputs.push(Buffer.from(buffer));
      if (decodeGate) await decodeGate;
      if (decodeError) throw decodeError;
      return { duration: decodeDuration, sampleRate: 16000, numberOfChannels: 1 };
    }
    createBufferSource() {
      const context = this;
      const node = {
        buffer: null,
        onended: null,
        startCalls: 0,
        stopCalls: 0,
        connectCalls: 0,
        disconnectCalls: 0,
        connect(destination) { this.connectCalls++; this.destination = destination; },
        start() { this.startCalls++; if (startError) throw startError; },
        stop() { this.stopCalls++; },
        disconnect() { this.disconnectCalls++; },
      };
      context.sources.push(node);
      return node;
    }
    close() { this.closeCalls++; return Promise.resolve(); }
  }

  const messageListeners = [];
  const posted = [];
  const parent = { postMessage(message) { posted.push(message); } };
  const window = {
    location: { href: "https://host.invalid/ui/voice-bubble-v1.html" },
    parent,
    AudioContext: contextAvailable ? FakeAudioContext : null,
    webkitAudioContext: undefined,
    addEventListener(type, listener) { if (type === "message") messageListeners.push(listener); },
  };
  const document = { getElementById(id) { return elements[id] ?? null; } };
  const navigator = ios
    ? { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", platform: "iPhone", maxTouchPoints: 5 }
    : { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", platform: "Win32", maxTouchPoints: 0 };

  vm.runInNewContext(script, {
    window,
    document,
    navigator,
    atob,
    btoa,
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    console,
  });

  function dispatch(record) {
    assert.ok(messageListeners.length > 0);
    for (const listener of messageListeners) {
      listener({
        source: parent,
        data: {
          jsonrpc: "2.0",
          method: "ui/notifications/tool-result",
          params: { structuredContent: { record } },
        },
      });
    }
  }

  async function clickPlay() {
    const listener = elements.play.listeners.click;
    assert.equal(typeof listener, "function");
    return listener();
  }

  return {
    elements,
    audio,
    play: elements.play,
    status: elements.status,
    diagnostic: elements["audio-output-diagnostic"],
    window,
    posted,
    contexts,
    dispatch,
    clickPlay,
    setDecodeDuration(value) { decodeDuration = value; },
    setDecodeError(value) { decodeError = value; },
    setDecodeGate(value) { decodeGate = value; },
    source(id = 0) { return contexts[id]?.sources[0]; },
  };
}

function generatedRecord(overrides = {}) {
  return {
    id: "voice_offline_generated_001",
    title: "Generated test record",
    text: "offline generated bridge",
    durationSeconds: fixture.durationSeconds,
    voiceLabel: "test",
    source: "minimax",
    generated: true,
    audioMimeType: "audio/wav",
    audioBase64: fixture.audioBase64,
    ...overrides,
  };
}

function privateFixtureRecord(overrides = {}) {
  return {
    id: "private_fixture_001",
    title: "Authorized fixture",
    text: "offline private fixture",
    durationSeconds: fixture.durationSeconds,
    voiceLabel: "fixture",
    source: "private-fixture",
    generated: false,
    audioMimeType: "audio/wav",
    audioBase64: fixture.audioBase64,
    ...overrides,
  };
}

test("generated audio waits for an explicit click and never enters HTMLAudioElement", async () => {
  const h = await createHarness();
  h.dispatch(generatedRecord());

  assert.equal(h.contexts.length, 0);
  assert.equal(h.audio.src, "");
  assert.equal(h.audio.loadCalls, 0);
  assert.equal(h.play.disabled, false);
  assert.match(h.status.textContent, /Web Audio/);

  await h.clickPlay();

  assert.equal(h.contexts.length, 1);
  assert.equal(h.contexts[0].resumeCalls, 1);
  assert.equal(h.contexts[0].decodedInputs.length, 1);
  assert.deepEqual(h.contexts[0].decodedInputs[0], fixtureBytes);
  assert.equal(h.contexts[0].sources.length, 1);
  assert.equal(h.contexts[0].sources[0].startCalls, 1);
  assert.equal(h.audio.src, "");
  assert.equal(h.audio.playCalls, 0);
  assert.match(h.status.textContent, /Web Audio/);
});

test("private fixture bypasses iOS media code 4 with click-gated Web Audio and no extra tool call", async () => {
  const h = await createHarness({ ios: true });
  h.audio.error = { code: 4 };
  h.audio.readyState = 0;

  h.dispatch(privateFixtureRecord());

  assert.equal(h.contexts.length, 0);
  assert.equal(h.audio.src, "");
  assert.equal(h.audio.loadCalls, 0);
  assert.equal(h.audio.playCalls, 0);
  assert.equal(h.play.disabled, false);
  assert.match(h.status.textContent, /Web Audio/);
  assert.match(h.diagnostic.textContent, /s1-ios-media4-20261026/);
  assert.match(h.diagnostic.textContent, /web-audio-private-fixture-ready/);
  assert.equal(h.posted.filter((message) => message.method === "tools/call").length, 0);

  await h.clickPlay();

  assert.equal(h.contexts.length, 1);
  assert.equal(h.contexts[0].resumeCalls, 1);
  assert.equal(h.contexts[0].decodedInputs.length, 1);
  assert.deepEqual(h.contexts[0].decodedInputs[0], fixtureBytes);
  assert.equal(h.contexts[0].sources.length, 1);
  assert.equal(h.contexts[0].sources[0].startCalls, 1);
  assert.equal(h.audio.src, "");
  assert.equal(h.audio.loadCalls, 0);
  assert.equal(h.audio.playCalls, 0);
  assert.equal(h.audio.error.code, 4);
  assert.match(h.diagnostic.textContent, /web-audio-private-fixture/);
  assert.match(h.diagnostic.textContent, /direct-click/);
  assert.match(h.diagnostic.textContent, /source started/);
  assert.doesNotMatch(h.diagnostic.textContent, new RegExp(fixture.audioBase64.slice(0, 24)));
  assert.doesNotMatch(h.status.textContent, /audible|played successfully/i);
  assert.equal(h.posted.filter((message) => message.method === "tools/call").length, 0);
});

test("private fixture rejects URL, generated, MIME and malformed WAV records without playback", async () => {
  const badRecords = [
    privateFixtureRecord({ generated: true }),
    privateFixtureRecord({ audioUrl: "https://example.invalid/private.wav" }),
    privateFixtureRecord({ audioMimeType: "audio/mpeg" }),
    privateFixtureRecord({ audioBase64: Buffer.alloc(200, 0x61).toString("base64") }),
    privateFixtureRecord({ audioBase64: "A".repeat(3_000_004) }),
  ];
  for (const record of badRecords) {
    const h = await createHarness({ ios: true });
    h.dispatch(record);
    assert.equal(h.contexts.length, 0);
    assert.equal(h.audio.src, "");
    assert.equal(h.audio.loadCalls, 0);
    assert.equal(h.play.disabled, true);
    await h.clickPlay();
    assert.equal(h.contexts.length, 0);
    assert.equal(h.audio.playCalls, 0);
  }
});

test("private fixture duplicate clicks start one source and a later click stops it", async () => {
  const h = await createHarness();
  const gate = deferred();
  h.setDecodeGate(gate.promise);
  h.dispatch(privateFixtureRecord());

  const first = h.clickPlay();
  const duplicate = h.clickPlay();
  assert.equal(h.contexts.length, 1);
  gate.resolve();
  await Promise.all([first, duplicate]);

  assert.equal(h.contexts.length, 1);
  assert.equal(h.contexts[0].sources.length, 1);
  assert.equal(h.contexts[0].sources[0].startCalls, 1);

  await h.clickPlay();
  assert.equal(h.contexts.length, 1);
  assert.equal(h.contexts[0].sources[0].stopCalls, 1);
  assert.equal(h.contexts[0].closeCalls, 1);
});

test("bad, oversized, URL-bearing and wrong-source generated records are rejected", async () => {
  const badRecords = [
    generatedRecord({ generated: false }),
    generatedRecord({ audioUrl: "https://example.invalid/generated.wav" }),
    generatedRecord({ audioMimeType: "audio/mpeg" }),
    generatedRecord({ audioBase64: Buffer.alloc(200, 0x61).toString("base64") }),
    generatedRecord({ audioBase64: "A".repeat(3_000_004) }),
    { ...generatedRecord(), source: "fixture" },
  ];

  for (const record of badRecords) {
    const h = await createHarness();
    h.dispatch(record);
    assert.equal(h.contexts.length, 0);
    assert.equal(h.audio.src, "");
    assert.equal(h.play.disabled, true);
    await h.clickPlay();
    assert.equal(h.contexts.length, 0);
  }
});

test("duplicate clicks do not create a second decoder or source and the next click stops playback", async () => {
  const h = await createHarness();
  const gate = deferred();
  h.setDecodeGate(gate.promise);
  h.dispatch(generatedRecord());

  const first = h.clickPlay();
  const duplicateWhileStarting = h.clickPlay();
  assert.equal(h.contexts.length, 1);
  gate.resolve();
  await Promise.all([first, duplicateWhileStarting]);

  assert.equal(h.contexts.length, 1);
  assert.equal(h.contexts[0].sources.length, 1);
  assert.equal(h.contexts[0].sources[0].startCalls, 1);

  await h.clickPlay();
  assert.equal(h.contexts.length, 1);
  assert.equal(h.contexts[0].sources[0].stopCalls, 1);
  assert.equal(h.contexts[0].closeCalls, 1);
});

test("a newer host result makes an in-flight generated decode stale and silent", async () => {
  const h = await createHarness();
  const gate = deferred();
  h.setDecodeGate(gate.promise);
  h.dispatch(generatedRecord({ text: "old result" }));
  const oldClick = h.clickPlay();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.contexts.length, 1);

  h.dispatch(generatedRecord({ text: "new result" }));
  gate.resolve();
  await oldClick;

  assert.equal(h.contexts.length, 1);
  assert.equal(h.contexts[0].sources.length, 0);
  assert.equal(h.contexts[0].closeCalls, 1);
  assert.equal(h.audio.src, "");
  assert.match(h.status.textContent, /Web Audio/);
});

test("host Web Audio failure, decode failure and invalid decoded duration fail closed", async () => {
  const noContext = await createHarness({ contextAvailable: false });
  noContext.dispatch(generatedRecord());
  await noContext.clickPlay();
  assert.equal(noContext.contexts.length, 0);
  assert.match(noContext.status.textContent, /Web Audio/);

  const decodeFailure = await createHarness();
  decodeFailure.setDecodeError(new Error("fake_decode_failure"));
  decodeFailure.dispatch(generatedRecord());
  await decodeFailure.clickPlay();
  assert.equal(decodeFailure.contexts[0].sources.length, 0);
  assert.equal(decodeFailure.contexts[0].closeCalls, 1);
  assert.match(decodeFailure.status.textContent, /解码失败/);

  const badDuration = await createHarness();
  badDuration.setDecodeDuration(61);
  badDuration.dispatch(generatedRecord());
  await badDuration.clickPlay();
  assert.equal(badDuration.contexts[0].sources.length, 0);
  assert.match(badDuration.status.textContent, /时长/);
});

test("legacy tone-fixture playback remains on the existing HTMLAudioElement path", async () => {
  const h = await createHarness();
  h.dispatch({
    id: "tone_fixture_legacy_001",
    text: "legacy tone",
    durationSeconds: fixture.durationSeconds,
    source: "tone-fixture",
    generated: false,
    audioMimeType: "audio/wav",
    audioBase64: fixture.audioBase64,
  });

  assert.equal(h.audio.src, "data:audio/wav;base64," + fixture.audioBase64);
  assert.equal(h.audio.loadCalls, 1);
  assert.equal(h.play.disabled, false);
  assert.equal(h.contexts.length, 0);

  await h.clickPlay();
  assert.equal(h.audio.playCalls, 1);
  assert.equal(h.contexts.length, 0);
});

test("iPhone fake harness records gesture, context, resume, decode and start without secrets", async () => {
  const h = await createHarness({ ios: true });
  h.dispatch(generatedRecord());
  await h.clickPlay();

  assert.equal(h.contexts.length, 1);
  assert.equal(h.contexts[0].sources.length, 1);
  assert.equal(h.contexts[0].sources[0].startCalls, 1);
  assert.match(h.diagnostic.textContent, /s1-ios-media4-20261026/);
  assert.match(h.diagnostic.textContent, /宿主 iOS/);
  assert.match(h.diagnostic.textContent, /路径 web-audio-generated/);
  assert.match(h.diagnostic.textContent, /手势 direct-click/);
  assert.match(h.diagnostic.textContent, /ctx running/);
  assert.match(h.diagnostic.textContent, /resume resolved/);
  assert.match(h.diagnostic.textContent, /decode ok 0\.70s 16000Hz 1ch/);
  assert.match(h.diagnostic.textContent, /source started/);
  assert.doesNotMatch(h.diagnostic.textContent, new RegExp(fixture.audioBase64.slice(0, 24)));
});

test("iPhone interrupted context fails closed before decode or source start", async () => {
  const h = await createHarness({ ios: true, initialContextState: "suspended", contextStateAfterResume: "interrupted" });
  h.dispatch(generatedRecord());
  await h.clickPlay();

  assert.equal(h.contexts.length, 1);
  assert.equal(h.contexts[0].resumeCalls, 1);
  assert.equal(h.contexts[0].decodedInputs.length, 0);
  assert.equal(h.contexts[0].sources.length, 0);
  assert.match(h.status.textContent, /上下文未运行/);
  assert.match(h.diagnostic.textContent, /ctx interrupted/);
  assert.match(h.diagnostic.textContent, /source failed/);
});

test("rejected resume and source start errors are diagnosed and never reported as audible", async () => {
  const resumeFailure = await createHarness({ ios: true, resumeError: new Error("NotAllowedError") });
  resumeFailure.dispatch(generatedRecord());
  await resumeFailure.clickPlay();
  assert.equal(resumeFailure.contexts[0].decodedInputs.length, 0);
  assert.equal(resumeFailure.contexts[0].sources.length, 0);
  assert.match(resumeFailure.status.textContent, /播放失败/);
  assert.match(resumeFailure.diagnostic.textContent, /source failed/);

  const startFailure = await createHarness({ ios: true, startError: new Error("InvalidStateError") });
  startFailure.dispatch(generatedRecord());
  await startFailure.clickPlay();
  assert.equal(startFailure.contexts[0].sources.length, 1);
  assert.equal(startFailure.contexts[0].sources[0].startCalls, 1);
  assert.match(startFailure.status.textContent, /播放失败/);
  assert.match(startFailure.diagnostic.textContent, /source failed/);
});
