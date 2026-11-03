/**
 * Offline-safe composition of the protected MCP proposal broker and the
 * authenticated player's read-only pending view.
 *
 * Both surfaces receive the same operation store and use the same canonical
 * principal derived from Auth0. This module has no paid confirmation handler,
 * provider, quota, audio or cloud-client dependency. Callers must provide an
 * already-approved operation store; the server does not silently substitute
 * an in-memory store when durable configuration or privacy policy is absent.
 */
import { createV1P2NonbillableProposalBroker } from "./v1-p2-nonbillable-proposal-broker.js";
import { createV1P2ReadonlyPlayerPendingHandler } from "./v1-p2-readonly-player-pending.js";

export function createV1P2NonbillablePlayerClosure({
  operationStore,
  mcpResolveVerifiedPrincipal,
  sessionSecret,
  clock,
  maximumProposals = 10,
  makeHandle,
  makeOperationId,
  operationTtlMs,
} = {}) {
  const broker = createV1P2NonbillableProposalBroker({
    resolveVerifiedPrincipal: mcpResolveVerifiedPrincipal,
    operationStore,
    ...(clock === undefined ? {} : { clock }),
    ...(makeHandle === undefined ? {} : { makeHandle }),
    ...(makeOperationId === undefined ? {} : { makeOperationId }),
    ...(operationTtlMs === undefined ? {} : { operationTtlMs }),
  });
  const pendingHandler = createV1P2ReadonlyPlayerPendingHandler({
    operationStore,
    sessionSecret,
    ...(clock === undefined ? {} : { clock }),
    maximumProposals,
  });
  return Object.freeze({ broker, pendingHandler });
}
