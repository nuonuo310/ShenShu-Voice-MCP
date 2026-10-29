/**
 * Staging-only sealed nonbillable closure candidate.
 *
 * server.js reaches this module only through the startup composition helper,
 * which shares one verified-identity resolver with the protected MCP route.
 * It returns null unless every staging identity, feature flag, session secret,
 * player client ID, 32-byte master key, D1 client and 005 schema preflight
 * succeeds. A boolean flag alone can never select plaintext or memory.
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
    Buffer.byteLength(value, "utf8") >= 32 &&
    Buffer.byteLength(value, "utf8") <= 256 &&
    !/[\x00-\x1f\x7f]/.test(value);
}

function validClientId(value) {
  return typeof value === "string" && /^[A-Za-z0-9]{10,128}$/.test(value);
}

/**
 * Nonsecret environment precheck shared by runtime composition and the
 * candidate. Only "sealed_config_ready" permits any D1 client construction.
 */
export function assessV1P2StagingSealedConfig(env = process.env) {
  if (env?.[STAGING_SEALED_PLAYER_FLAG] !== "1") return "sealed_flag_off";
  if (env?.SHENSHU_NONBILLABLE_PLAYER_ENABLED !== "1") return "nonbillable_flag_off";
  if (env?.SHENSHU_PLAYER_ENABLED !== "1") return "player_flag_off";
  if (env?.SHENSHU_AUTH_MCP_ENABLED !== "1") return "auth_mcp_flag_off";
  const identity = resolveProtectedResourceIdentity(env);
  if (identity.ok !== true) return "staging_identity_invalid";
  if (identity.staging !== true) return "not_staging";
  if (!decodeMasterKey(env?.[PRIVATE_TEXT_MASTER_KEY_ENV])) return "master_key_invalid";
  if (!validSessionSecret(env?.SHENSHU_PLAYER_SESSION_SECRET)) return "session_secret_invalid";
  if (!validClientId(env?.SHENSHU_PLAYER_AUTH0_CLIENT_ID)) return "player_client_id_invalid";
  return "sealed_config_ready";
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
    if (typeof createD1Client !== "function" ||
        typeof mcpResolveVerifiedPrincipal !== "function" ||
        !Number.isSafeInteger(maximumDailyCalls) ||
        maximumDailyCalls < 1 ||
        maximumDailyCalls > V1_OFFLINE_MAX_DAILY_CALLS) {
      return null;
    }
    if (assessV1P2StagingSealedConfig(env) !== "sealed_config_ready") return null;
    const masterKey = decodeMasterKey(env?.[PRIVATE_TEXT_MASTER_KEY_ENV]);
    const sessionSecret = env?.SHENSHU_PLAYER_SESSION_SECRET;
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
