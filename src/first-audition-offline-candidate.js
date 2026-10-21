/**
 * Offline-only rehearsal for exactly one future MiniMax audition.
 *
 * This module is intentionally NOT registered on an MCP route. It composes the
 * already-reviewed pieces in this order: verified identity -> trusted one-use
 * consent capability -> one-slot durable admission -> one fake upstream attempt
 * -> WAV validation -> the existing live-voice record shape.
 *
 * The fetch function is injected and must not be the runtime's real fetch.
 * The consent callback may issue a short-lived capability, but only the
 * server-side capability store can consume it. No secrets, principal values,
 * consent identifiers or audio are logged.
 */
import { randomUUID } from "node:crypto";
import {
  AUDITION_CONSENT_ACTION,
  auditionTextDigest,
} from "./audition-consent-capability.js";
import { checkText } from "./contract.js";
import { createLiveVoice } from "./live-voice.js";
import { DEFAULT_MODEL_ID, synthesizeMiniMax } from "./minimax-adapter.js";
import { createServerOwnedVoiceAdmission } from "./server-owned-voice-admission.js";

const IDENT = /^[A-Za-z0-9_-]{8,128}$/;
const MAX_TIMEOUT_MS = 60_000;

export const FIRST_AUDITION_DAILY_LIMIT = 1;

export function createOfflineFirstAuditionCandidate({
  resolveVerifiedPrincipal,
  requestOperatorConsent,
  consentStore,
  store,
  apiKey,
  voiceId,
  fetchImpl,
  timeoutMs = MAX_TIMEOUT_MS,
  clock = () => new Date(),
  makeRequestId = randomUUID,
  makeGrantId = () => "grant_" + randomUUID().replaceAll("-", ""),
} = {}) {
  if (
    typeof resolveVerifiedPrincipal !== "function" ||
    typeof requestOperatorConsent !== "function" ||
    !consentStore ||
    typeof consentStore.consume !== "function" ||
    !store ||
    typeof store.reserveAtomic !== "function" ||
    typeof store.issue !== "function" ||
    typeof store.consume !== "function" ||
    typeof apiKey !== "string" ||
    apiKey.trim().length === 0 ||
    typeof voiceId !== "string" ||
    voiceId.trim().length === 0 ||
    typeof fetchImpl !== "function" ||
    fetchImpl === globalThis.fetch ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 10 ||
    timeoutMs > MAX_TIMEOUT_MS ||
    typeof clock !== "function" ||
    typeof makeRequestId !== "function" ||
    typeof makeGrantId !== "function"
  ) {
    throw new Error("candidate_unavailable");
  }

  return async function rehearseFirstAudition({ trustedRequest, text } = {}) {
    const safeText = checkText(text);
    const textBytes = Buffer.byteLength(safeText, "utf8");
    const textDigest = auditionTextDigest(safeText);
    const identity = await resolveVerifiedPrincipal(trustedRequest);
    if (
      !identity ||
      identity.verified !== true ||
      !IDENT.test(identity.subject ?? "")
    ) {
      throw new Error("not_authorized");
    }

    const requestId = makeRequestId();
    if (!IDENT.test(requestId ?? "")) throw new Error("invalid_request_id");

    const admission = createServerOwnedVoiceAdmission({
      verifiedSubject: identity.subject,
      store,
      clock,
      makeGrantId,
      maximumDailyCalls: FIRST_AUDITION_DAILY_LIMIT,
    });

    const authorize = async ({ action, textBytes: authorizedBytes, requestId: authorizedRequestId }) => {
      if (action !== AUDITION_CONSENT_ACTION ||
          authorizedBytes !== textBytes ||
          authorizedRequestId !== requestId) {
        throw new Error("not_authorized");
      }

      let capability;
      try {
        capability = await requestOperatorConsent({
          principal: identity.subject,
          action,
          textBytes,
          textDigest,
          requestId,
        });
      } catch {
        throw new Error("consent_denied");
      }
      if (typeof capability !== "string" || capability.length === 0) {
        throw new Error("consent_denied");
      }

      let consent;
      try {
        consent = await consentStore.consume({
          capability,
          principal: identity.subject,
          action,
          textBytes,
          textDigest,
          requestId,
        });
      } catch {
        throw new Error("consent_denied");
      }
      if (consent?.consumed !== true ||
          consent.principal !== identity.subject ||
          consent.action !== action) {
        throw new Error("consent_denied");
      }

      return admission({ action, textBytes, requestId });
    };

    const synthesize = ({ text: nextText }) =>
      synthesizeMiniMax({
        text: nextText,
        apiKey,
        voiceId,
        modelId: DEFAULT_MODEL_ID,
        fetchImpl,
        timeoutMs,
      });

    return createLiveVoice({
      text: safeText,
      authorize,
      synthesize,
      requestId,
    });
  };
}
