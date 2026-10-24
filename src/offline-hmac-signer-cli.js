/**
 * Narrow synthetic-only CLI for the offline signer libraries.
 *
 * Input is bounded JSON on stdin. No command-line argument, environment
 * variable, network call, file write or credential prompt is implemented.
 * Output is limited to redacted counters and stable STOP codes.
 */
import { prepareOfflineSignerPlan } from "./offline-hmac-signer.js";

const MAX_INPUT_BYTES = 64 * 1024;
const SAFE_CODES = new Set([
  "offline_signer_budget_exhausted",
  "offline_signer_config_invalid",
  "offline_signer_input_invalid",
  "offline_signer_internal_error",
  "offline_signer_replay_rejected",
  "offline_signer_request_invalid",
]);

async function readBoundedStdin() {
  const chunks = [];
  let total = 0;
  for await (const chunk of process.stdin) {
    total += chunk.byteLength;
    if (total > MAX_INPUT_BYTES) throw new Error("offline_signer_input_invalid");
    chunks.push(chunk);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("offline_signer_input_invalid");
  }
}

function safeCode(error) {
  return SAFE_CODES.has(error?.message)
    ? error.message
    : "offline_signer_internal_error";
}

async function main() {
  if (process.argv.length !== 2) {
    throw new Error("offline_signer_input_invalid");
  }
  const text = await readBoundedStdin();
  let input;
  try {
    input = JSON.parse(text);
  } catch {
    throw new Error("offline_signer_input_invalid");
  }
  const result = await prepareOfflineSignerPlan(input);
  process.stdout.write(JSON.stringify({
    status: result.status,
    mode: result.mode,
    planId: result.planId,
    preparedCount: result.preparedCount,
    usage: result.usage,
    providerCalls: result.providerCalls,
  }) + "\n");
}

main().catch(error => {
  process.stderr.write(JSON.stringify({
    status: "blocked",
    code: safeCode(error),
  }) + "\n");
  process.exitCode = 2;
});
