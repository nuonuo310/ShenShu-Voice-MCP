/**
 * Staging-only sealed nonbillable closure candidate.
 *
 * This module is not imported by server.js. It is the single server-side
 * composition path that a future explicitly authorized deployment may call.
 * It returns null unless every staging identity, feature flag, session secret,
 * 32-byte master key, D1 client and 005 schema preflight succeeds. A boolean
 * flag alone can never select plaintext or an in-memory fallback.
 */
import { createCloudflareD1Http } from "./cloudflare-d1-http.js";
import { createD1P2ConfirmationOperationStore } from "./d1-p2-confirmation-operation-store.js";
import { resolveProtectedResourceIdentity } from "./protected-resource-identity.js";
import { createV1P2NonbillablePlayerClosure } from "./v1-p2-nonbillable-player-closure.js";
import { createPrivateTextSealer } from "./v1-p2-private-text-sealer.js";
import { V1_OFFLINE_MAX_DAILY_CALLS } from "./v1-offline-paid-pipeline.js";

export const STAGING_SEALED_PLAYER_FLAG =
  "SHENSHU_STAGING_SEALED_PLAYER_ENABLED";
export const PRIVATE_TEXT_MASTER_KEY_ENV =
  "SHENSHU_PRIVATE_TEXT_MASTER_KEY_BASE64";

function decodeMasterKey(value) {
  if (typeof value !== "string") return null;
  let key;
  if (/^[A-Za-z0-9_-]{43}$/.test(value)) {
    key = Buffer.from(value, "base64url");
    if (key.toString("base64url") !== value) return null;
  } else if (/^[A-Za-z0-9+/]{43}=$/.test(value)) {
    key = Buffer.from(value, "base64");
    if (key.toString("base64") !== value) return null;
  } else {
    return null;
  }
  return key.length === 32 && key.some(byte => byte !== 0) ? key : null;
}

function validSessionSecret(value) {
  return typeof value === "string" &&
    value.length >= 32 && value.length <= 4096 &&
    !/[\x00-\x1f\x7f]/.test(value);
}

export async function createV1P2StagingSealedClosureCandidate({
  env = process.env,
  createD1Client = createCloudflareD1Http,
  mcpResolveVerifiedPrincipal = null,
  ledgerClock,
  maximumDailyCalls = V1_OFFLINE_MAX_DAILY_CALLS,
  maximumProposals = 10,
  makeHandle,
  makeOperationId,
  operationTtlMs,
} = {}) {
  try {
    if (env?.[STAGING_SEALED_PLAYER_FLAG] !== "1" ||
        env?.SHENSHU_NONBILLABLE_PLAYER_ENABLED !== "1" ||
        env?.SHENSHU_PLAYER_ENABLED !== "1" ||
        env?.SHENSHU_AUTH_MCP_ENABLED !== "1" ||
        typeof createD1Client !== "function" ||
        typeof mcpResolveVerifiedPrincipal !== "function" ||
        !Number.isSafeInteger(maximumDailyCalls) ||
        maximumDailyCalls < 1 ||
        maximumDailyCalls > V1_OFFLINE_MAX_DAILY_CALLS) {
      return null;
    }
    const identity = resolveProtectedResourceIdentity(env);
    if (identity.ok !== true || identity.staging !== true) return null;

    const masterKey = decodeMasterKey(env?.[PRIVATE_TEXT_MASTER_KEY_ENV]);
    const sessionSecret = env?.SHENSHU_PLAYER_SESSION_SECRET;
    if (!masterKey || !validSessionSecret(sessionSecret)) return null;

    const client = createD1Client({ env });
    if (!client || typeof client.query !== "function") return null;
    const textSealer = createPrivateTextSealer({ masterKey });
    const operationStore = createD1P2ConfirmationOperationStore({
      client,
      maximumDailyCalls,
      textSealer,
    });
    await operationStore.verifySchema();

    return createV1P2NonbillablePlayerClosure({
      operationStore,
      mcpResolveVerifiedPrincipal,
      sessionSecret,
      ...(ledgerClock === undefined ? {} : { clock: ledgerClock }),
      maximumProposals,
      ...(makeHandle === undefined ? {} : { makeHandle }),
      ...(makeOperationId === undefined ? {} : { makeOperationId }),
      ...(operationTtlMs === undefined ? {} : { operationTtlMs }),
    });
  } catch {
    return null;
  }
}
