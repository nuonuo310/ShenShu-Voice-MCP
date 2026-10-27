/**
 * Offline-only composition for the Voice V1 P2 D1 explicit-confirmation
 * candidate. It is deliberately not imported by server.js or any MCP route.
 *
 * ChatGPT MCP may only reach the shared broker's nonbillable initiate/status
 * methods through the protected JWT verifier. The standalone Auth0 player is
 * the only surface whose module-private session capability can reach confirm.
 * Both paths must derive the same canonical principal; a mismatch makes the
 * owner-scoped D1 handle invisible before any admission or provider work.
 *
 * The D1 claim is the only billing authority. It commits the operation
 * transition, one daily slot, and a consumed grant in one statement. The
 * broker's authorizePaidAttempt callback only attests that committed admission;
 * it cannot create a second reservation.
 */
import { createD1P2ConfirmationOperationStore } from "./d1-p2-confirmation-operation-store.js";
import { createV1P2StableOperationBroker } from "./v1-p2-stable-operation-identity.js";
import {
  createV1P2PlayerConfirmationHandler,
  createV1P2PlayerSessionPrincipalResolver,
} from "./v1-p2-player-confirmation.js";
import { V1_OFFLINE_MAX_DAILY_CALLS } from "./v1-offline-paid-pipeline.js";

export function createV1P2D1Confirmation({
  client,
  maximumDailyCalls = V1_OFFLINE_MAX_DAILY_CALLS,
  voiceId,
  synthesize,
  privateResultStore,
  mcpResolveVerifiedPrincipal,
  sessionSecret,
  clock = () => new Date(),
  makeHandle,
  makeOperationId,
  operationTtlMs,
  maximumProposals = 10,
} = {}) {
  if (typeof mcpResolveVerifiedPrincipal !== "function") {
    throw new Error("d1_confirmation_unavailable");
  }
  if (typeof clock !== "function") throw new Error("d1_confirmation_unavailable");

  // The broker accepts Date or milliseconds, but the existing player session
  // parser accepts only a finite millisecond number. Normalize once so the MCP
  // and player surfaces cannot drift.
  function clockMs() {
    const value = clock();
    const ms = value instanceof Date ? value.valueOf() : value;
    if (!Number.isSafeInteger(ms) || ms < 0) {
      throw new Error("d1_confirmation_clock_error");
    }
    return ms;
  }

  const operationStore = createD1P2ConfirmationOperationStore({
    client,
    maximumDailyCalls,
  });
  const playerResolver = createV1P2PlayerSessionPrincipalResolver();

  // The player capability is a module-private Symbol and cannot appear in JSON,
  // form fields or MCP arguments. Only a request carrying it can use the player
  // resolver; everything else must pass the protected JWT verifier.
  async function resolveVerifiedPrincipal(trustedRequest) {
    try {
      return await playerResolver(trustedRequest);
    } catch (error) {
      if (error?.message !== "not_authorized") throw error;
    }
    return mcpResolveVerifiedPrincipal(trustedRequest);
  }

  const broker = createV1P2StableOperationBroker({
    resolveVerifiedPrincipal,
    operationStore,
    authorizePaidAttempt: async ({ principal, operationId }) => {
      const attested = await operationStore.attestAdmission({ principal, operationId });
      if (attested?.admitted !== true) throw new Error("admission_invalid");
      return Object.freeze({
        allowed: true,
        principal,
        oneTime: true,
        requestId: operationId,
      });
    },
    synthesize,
    privateResultStore,
    voiceId,
    maximumDailyCalls,
    clock: clockMs,
    ...(makeHandle ? { makeHandle } : {}),
    ...(makeOperationId ? { makeOperationId } : {}),
    ...(operationTtlMs ? { operationTtlMs } : {}),
  });

  const playerHandler = createV1P2PlayerConfirmationHandler({
    operationStore,
    broker,
    sessionSecret,
    clock: clockMs,
    maximumProposals,
  });

  return Object.freeze({ operationStore, broker, playerHandler });
}
