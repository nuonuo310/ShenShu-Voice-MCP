/**
 * Prospective Voice V1 P2 stage codes.
 *
 * No persistent log, I/O, user data, clock, operation ID or error object.
 * The optional hook is NOT wired from the deployable server. A later bounded
 * activation must separately establish storage, privacy and consent rules.
 */
export const V1_P2_STAGE = Object.freeze({
  D1_CLAIMED: "d1_claimed",
  D1_PENDING_READY: "d1_provider_pending_ready",
  D1_PENDING_FAILED: "d1_provider_pending_failed",
  PROVIDER_ATTEMPT: "provider_attempt_started",
  PROVIDER_RETURNED: "provider_adapter_returned",
  PROVIDER_FAILED: "provider_adapter_failed",
  PIPELINE_READY: "pipeline_ready",
  PIPELINE_FAILED: "pipeline_failed",
  AUDIO_READY: "audio_accepted",
  AUDIO_FAILED: "audio_rejected",
  PRIVATE_SAVE_STARTED: "private_save_started",
  PRIVATE_SAVE_READY: "private_save_succeeded",
  PRIVATE_SAVE_FAILED: "private_save_failed",
  D1_COMPLETION_STARTED: "d1_completion_started",
  D1_COMPLETION_READY: "d1_completion_succeeded",
  D1_COMPLETION_FAILED: "d1_completion_failed",
});

const ALLOWED_STAGES = new Set(Object.values(V1_P2_STAGE));

/** Offline observer: callback receives exactly one frozen stage-code string. */
export function createV1P2StageEmitter(onStageDiagnostic = null) {
  if (onStageDiagnostic !== null && typeof onStageDiagnostic !== "function") {
    throw new Error("diagnostic_observer_invalid");
  }
  return function emitStage(stage) {
    if (!ALLOWED_STAGES.has(stage)) throw new Error("diagnostic_stage_invalid");
    if (onStageDiagnostic === null) return;
    try {
      // Deliberately NO exception or extra field passes into the observer.
      // An observer failure cannot alter quota, retries or paid outcome.
      onStageDiagnostic(stage);
    } catch {
      // Optional diagnostics must never become payment authority.
    }
  };
}
