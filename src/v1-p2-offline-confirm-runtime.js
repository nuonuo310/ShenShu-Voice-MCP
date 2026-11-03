/**
 * Explicitly test-only offline composition for the full Voice V1 P2 journey.
 *
 * This module must never be imported by server.js. It exists so a Node24 test
 * can exercise the complete protected-MCP -> owner form confirm -> sealed
 * 004+005 claim -> one fake provider -> private result store -> owner WAV
 * path over real HTTP. It requires NODE_ENV=test plus an explicit offline flag,
 * a local client, a synthetic text sealer, an injected fake synthesizer and a
 * test-only private result store. It has no real provider, cloud or storage
 * backend of its own.
 */
import { createServer as createHttpServer } from "node:http";
import { createP2PlayerAudioLoader } from "./p2-private-result-store.js";
import { handlePrivateWebPlayer } from "./private-web-player.js";
import {
  PAID_PATH,
  resolveProtectedResourceIdentity,
} from "./protected-resource-identity.js";
import { handleStagingAuthenticatedMcp } from "./staging-authenticated-mcp.js";
import { createVerifiedIdentityResolver } from "./verified-identity.js";
import { createV1P2D1Confirmation } from "./v1-p2-d1-confirmation.js";

export const OFFLINE_CONFIRM_TEST_FLAG =
  "SHENSHU_OFFLINE_CONFIRM_TEST_ONLY";

function clockMs(clock) {
  const value = clock();
  const ms = value instanceof Date ? value.valueOf() : value;
  if (!Number.isSafeInteger(ms) || ms < 0) {
    throw new Error("offline_confirm_clock_error");
  }
  return ms;
}

export async function createV1P2OfflineConfirmRuntime({
  env = process.env,
  client,
  textSealer,
  privateResultStore,
  synthesize,
  voiceId,
  sessionSecret,
  clock = () => new Date(),
  maximumDailyCalls = 1,
  operationTtlMs,
  maximumProposals = 10,
} = {}) {
  if (env?.NODE_ENV !== "test" ||
      env?.[OFFLINE_CONFIRM_TEST_FLAG] !== "1") {
    throw new Error("offline_confirm_runtime_unavailable");
  }
  if (!client || typeof client.query !== "function" ||
      !textSealer || typeof textSealer.seal !== "function" ||
      typeof textSealer.open !== "function" ||
      typeof textSealer.digestBinding !== "function" ||
      !privateResultStore ||
      typeof privateResultStore.save !== "function" ||
      typeof privateResultStore.getLatest !== "function" ||
      typeof synthesize !== "function" ||
      typeof sessionSecret !== "string" ||
      typeof clock !== "function") {
    throw new Error("offline_confirm_runtime_unavailable");
  }

  const identity = resolveProtectedResourceIdentity(env);
  if (identity.ok !== true || identity.staging !== true) {
    throw new Error("offline_confirm_runtime_unavailable");
  }

  const now = () => clockMs(clock);
  // Offline composition is deliberately static-JWKS and test-clock only. It
  // reuses the authoritative resolver, not a second verification algorithm.
  if (env.SHENSHU_AUTH_MCP_ENABLED !== "1" ||
      env.SHENSHU_AUTH_STATIC_JWKS_TEST_ONLY !== "1" ||
      typeof env.SHENSHU_AUTH_PUBLIC_JWKS_JSON !== "string" ||
      env.SHENSHU_AUTH_PUBLIC_JWKS_JSON.length === 0) {
    throw new Error("offline_confirm_runtime_unavailable");
  }
  let verifier;
  try {
    const jwks = JSON.parse(env.SHENSHU_AUTH_PUBLIC_JWKS_JSON);
    if (!Array.isArray(jwks?.keys) || jwks.keys.length < 1 ||
        jwks.keys.length > 10) {
      throw new Error("invalid_jwks");
    }
    verifier = createVerifiedIdentityResolver({
      issuer: identity.issuer,
      audience: identity.paidResource,
      publicJwks: jwks.keys,
      requiredScopes: ["voice:speak"],
      maxLifetimeSeconds: 86400,
      clock: now,
    });
  } catch {
    throw new Error("offline_confirm_runtime_unavailable");
  }
  const confirmation = createV1P2D1Confirmation({
    client,
    maximumDailyCalls,
    voiceId,
    synthesize,
    privateResultStore,
    mcpResolveVerifiedPrincipal: verifier,
    sessionSecret,
    clock: now,
    maximumProposals,
    textSealer,
    ...(operationTtlMs === undefined ? {} : { operationTtlMs }),
  });
  const schema = await confirmation.operationStore.verifySchema();
  if (schema?.ok !== true || schema?.sealedText !== true) {
    throw new Error("offline_confirm_runtime_schema_unqualified");
  }

  const loadAudio = createP2PlayerAudioLoader({ privateResultStore });
  const server = createHttpServer(async (req, res) => {
    if (!req.url) {
      res.writeHead(400).end("missing_url");
      return;
    }
    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
    try {
      // The explicit-confirm form and owner pending page are mounted only in
      // this offline composition, never in the deployable server entry.
      if (await confirmation.playerHandler.handle(req, res, url)) return;
      if (await handlePrivateWebPlayer(req, res, url, {
        env,
        // Even the test-only server must not inherit a reachable Auth0 or
        // provider client through a player callback.
        fetchImpl: async () => {
          throw new Error("offline_network_forbidden");
        },
        clock: now,
        loadAudio,
      })) return;
      if (url.pathname === PAID_PATH) {
        await handleStagingAuthenticatedMcp(req, res, {
          env,
          issuer: identity.issuer,
          audience: identity.paidResource,
          resourceMetadataUrl: identity.resourceMetadataUrl,
          jwksCache: null,
          identityVerifier: verifier,
          proposalBroker: confirmation.broker,
        });
        return;
      }
      res.writeHead(404).end("not_found");
    } catch {
      if (!res.headersSent) res.writeHead(500).end("internal_error");
      else if (!res.writableEnded) res.end();
    }
  });

  return Object.freeze({ server, confirmation, loadAudio, schema });
}
