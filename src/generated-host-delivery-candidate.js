/**
 * Local-only candidate for a future app-only OAuth host-delivery probe.
 *
 * This module deliberately does not register an MCP tool or resource. It
 * creates a bounded generated-shape record from the existing synthetic WAV so
 * the UI message contract can be reviewed without invoking MiniMax or D1.
 */
import { prepareGeneratedWebAudioBridge } from "./generated-audio-playback-contract.js";
import { makeInlineToneFixture } from "./inline-fixture.js";

export const NONBILLABLE_GENERATED_TEST_LABEL = "NONBILLABLE TEST";
export const PROPOSED_GENERATED_HOST_TOOL_NAME = "probe_oauth_generated_delivery";

export function makeNonbillableGeneratedHostRecord() {
  const fixture = makeInlineToneFixture();
  const record = {
    id: "host_delivery_fake_generated_001",
    title: "NONBILLABLE TEST - generated-shape WAV",
    text: "NONBILLABLE TEST: fixed synthetic tone; not MiniMax speech.",
    durationSeconds: fixture.durationSeconds,
    voiceLabel: NONBILLABLE_GENERATED_TEST_LABEL,
    source: "minimax",
    generated: true,
    audioMimeType: fixture.audioMimeType,
    audioBase64: fixture.audioBase64,
    hostDeliveryTest: true,
    providerInvoked: false,
    billable: false,
  };
  prepareGeneratedWebAudioBridge(record);
  return Object.freeze(record);
}

export function makeNonbillableGeneratedHostToolResult() {
  const record = makeNonbillableGeneratedHostRecord();
  return {
    content: [{
      type: "text",
      text: "NONBILLABLE TEST only: synthetic generated-shape WAV; no MiniMax call or D1 access.",
    }],
    structuredContent: { record },
  };
}

export function makeMcpAppsToolResultNotification(result = makeNonbillableGeneratedHostToolResult()) {
  const record = result?.structuredContent?.record;
  prepareGeneratedWebAudioBridge(record);
  if (record.hostDeliveryTest !== true ||
      record.providerInvoked !== false ||
      record.billable !== false) {
    throw new Error("invalid_nonbillable_generated_test");
  }
  return {
    jsonrpc: "2.0",
    method: "ui/notifications/tool-result",
    params: result,
  };
}
