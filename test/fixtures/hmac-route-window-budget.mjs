/**
 * Plan-only accounting for a future, separately authorized HMAC route window.
 *
 * This fixture has no network, Worker URL, key material, provider client or
 * execution path. It freezes a deterministic worst-case request plan and
 * rejects any accounting input above the PR #104 ceilings.
 */
export const HMAC_ROUTE_BUDGET_CAPS = Object.freeze({
  workerHttpRequests: 24,
  d1TouchingRequests: 18,
  admissionRequests: 10,
  acceptedAdmissions: 4,
  rowWriteUnits: 32,
  rowsRead: 512,
  statements: 64,
  storageDeltaBytes: 256 * 1024,
  durationMs: 20 * 60 * 1000,
  providerCalls: 0,
});

const PLAN_KEYS = ["durationMs", "operations", "planId", "providerCalls"];
const ENTRY_KEYS = [
  "accepted",
  "admission",
  "d1Touching",
  "expectedStatus",
  "id",
  "requestClass",
  "route",
  "rowWriteUnits",
  "rowsRead",
  "statements",
  "storageDeltaBytes",
];
const ROUTES = new Set([
  "admit",
  "status",
  "provider-pending",
  "completed",
  "unknown",
]);
const REQUEST_CLASSES = new Set([
  "valid",
  "unsigned",
  "forged",
  "wrong-key",
  "stale",
  "wrong-host",
  "query",
]);
const ID = /^[A-Za-z0-9_-]{8,128}$/;

function invalid() {
  throw new Error("hmac_route_plan_invalid");
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return keys.length === wanted.length && keys.every((key, index) => key === wanted[index]);
}

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function operation(
  id,
  route,
  requestClass,
  expectedStatus,
  {
    d1Touching = false,
    admission = false,
    accepted = false,
    statements = 0,
    rowWriteUnits = 0,
    rowsRead = 0,
    storageDeltaBytes = 0,
  } = {},
) {
  return Object.freeze({
    id,
    route,
    requestClass,
    expectedStatus,
    d1Touching,
    admission,
    accepted,
    statements,
    rowWriteUnits,
    rowsRead,
    storageDeltaBytes,
  });
}

const operations = [
  operation("N01_unsigned_admit", "admit", "unsigned", 403, { admission: true }),
  operation("N02_forged_admit", "admit", "forged", 403, { admission: true }),
  operation("N03_wrong_key_admit", "admit", "wrong-key", 403, { admission: true }),
  operation("N04_stale_status", "status", "stale", 403),
  operation("N05_wrong_host_status", "status", "wrong-host", 403),
  operation("N06_query_status", "status", "query", 403),

  operation("A01_admit", "admit", "valid", 200, {
    d1Touching: true, admission: true, accepted: true,
    statements: 5, rowWriteUnits: 4, rowsRead: 16, storageDeltaBytes: 4096,
  }),
  operation("A02_admit", "admit", "valid", 200, {
    d1Touching: true, admission: true, accepted: true,
    statements: 5, rowWriteUnits: 4, rowsRead: 16, storageDeltaBytes: 4096,
  }),
  operation("A03_admit", "admit", "valid", 200, {
    d1Touching: true, admission: true, accepted: true,
    statements: 5, rowWriteUnits: 4, rowsRead: 16, storageDeltaBytes: 4096,
  }),
  operation("A04_daily_limit", "admit", "valid", 429, {
    d1Touching: true, admission: true,
    statements: 5, rowsRead: 16,
  }),
  operation("B01_admit", "admit", "valid", 200, {
    d1Touching: true, admission: true, accepted: true,
    statements: 5, rowWriteUnits: 4, rowsRead: 16, storageDeltaBytes: 4096,
  }),
  operation("A05_exact_replay", "admit", "valid", 200, {
    d1Touching: true, admission: true, statements: 1, rowsRead: 32,
  }),
  operation("A06_digest_conflict", "admit", "valid", 409, {
    d1Touching: true, admission: true, statements: 1, rowsRead: 32,
  }),

  operation("S01_b_status", "status", "valid", 200, {
    d1Touching: true, statements: 1, rowsRead: 2,
  }),
  operation("S02_a1_status", "status", "valid", 200, {
    d1Touching: true, statements: 1, rowsRead: 2,
  }),
  operation("S03_a2_status", "status", "valid", 200, {
    d1Touching: true, statements: 1, rowsRead: 2,
  }),
  operation("S04_a3_status", "status", "valid", 200, {
    d1Touching: true, statements: 1, rowsRead: 2,
  }),
  operation("T01_provider_pending", "provider-pending", "valid", 200, {
    d1Touching: true, statements: 1, rowWriteUnits: 1, rowsRead: 2,
    storageDeltaBytes: 4096,
  }),
  operation("T02_completed", "completed", "valid", 200, {
    d1Touching: true, statements: 1, rowWriteUnits: 1, rowsRead: 2,
    storageDeltaBytes: 4096,
  }),
  operation("T03_unknown", "unknown", "valid", 200, {
    d1Touching: true, statements: 1, rowWriteUnits: 1, rowsRead: 2,
    storageDeltaBytes: 4096,
  }),
  operation("S05_a3_status", "status", "valid", 200, {
    d1Touching: true, statements: 1, rowsRead: 2,
  }),
  operation("S06_b_status", "status", "valid", 200, {
    d1Touching: true, statements: 1, rowsRead: 2,
  }),
  operation("S07_a2_status", "status", "valid", 200, {
    d1Touching: true, statements: 1, rowsRead: 2,
  }),
  operation("S08_a3_status", "status", "valid", 200, {
    d1Touching: true, statements: 1, rowsRead: 2,
  }),
];

export const HMAC_ROUTE_WINDOW_PLAN = Object.freeze({
  planId: "hmac-route-window-offline-plan-20261024",
  durationMs: HMAC_ROUTE_BUDGET_CAPS.durationMs,
  providerCalls: 0,
  operations: Object.freeze(operations),
});

function validateEntry(entry) {
  if (!exactKeys(entry, ENTRY_KEYS) || !ID.test(entry.id ?? "") ||
      !ROUTES.has(entry.route) || !REQUEST_CLASSES.has(entry.requestClass) ||
      !Number.isSafeInteger(entry.expectedStatus) ||
      entry.expectedStatus < 100 || entry.expectedStatus > 599 ||
      typeof entry.d1Touching !== "boolean" ||
      typeof entry.admission !== "boolean" ||
      typeof entry.accepted !== "boolean" ||
      !nonNegativeInteger(entry.statements) ||
      !nonNegativeInteger(entry.rowWriteUnits) ||
      !nonNegativeInteger(entry.rowsRead) ||
      !nonNegativeInteger(entry.storageDeltaBytes)) {
    invalid();
  }
  if (entry.admission !== (entry.route === "admit")) invalid();
  if ((entry.requestClass === "valid") !== entry.d1Touching) invalid();
  if (entry.accepted && (!entry.d1Touching || !entry.admission ||
      entry.expectedStatus !== 200)) {
    invalid();
  }
  if (!entry.d1Touching && (entry.statements !== 0 || entry.rowWriteUnits !== 0 ||
      entry.rowsRead !== 0 || entry.storageDeltaBytes !== 0)) {
    invalid();
  }
  if (entry.d1Touching && entry.statements < 1) invalid();
}

export function assertHmacRouteWindowUsage(usage) {
  if (!exactKeys(usage, Object.keys(HMAC_ROUTE_BUDGET_CAPS))) invalid();
  const normalized = {};
  for (const [name, cap] of Object.entries(HMAC_ROUTE_BUDGET_CAPS)) {
    const value = usage[name];
    if (!nonNegativeInteger(value) || value > cap) invalid();
    normalized[name] = value;
  }
  if (normalized.providerCalls !== 0) invalid();
  return Object.freeze(normalized);
}

export function summarizeHmacRouteWindowPlan(plan = HMAC_ROUTE_WINDOW_PLAN) {
  if (!exactKeys(plan, PLAN_KEYS) || !ID.test(plan.planId ?? "") ||
      !Array.isArray(plan.operations) || plan.operations.length < 1 ||
      plan.operations.length > HMAC_ROUTE_BUDGET_CAPS.workerHttpRequests ||
      !nonNegativeInteger(plan.durationMs) || plan.providerCalls !== 0) {
    invalid();
  }
  const ids = new Set();
  const totals = {
    workerHttpRequests: 0,
    d1TouchingRequests: 0,
    admissionRequests: 0,
    acceptedAdmissions: 0,
    rowWriteUnits: 0,
    rowsRead: 0,
    statements: 0,
    storageDeltaBytes: 0,
    durationMs: plan.durationMs,
    providerCalls: plan.providerCalls,
  };
  for (const entry of plan.operations) {
    validateEntry(entry);
    if (ids.has(entry.id)) invalid();
    ids.add(entry.id);
    totals.workerHttpRequests += 1;
    if (entry.d1Touching) totals.d1TouchingRequests += 1;
    if (entry.admission) totals.admissionRequests += 1;
    if (entry.accepted) totals.acceptedAdmissions += 1;
    totals.rowWriteUnits += entry.rowWriteUnits;
    totals.rowsRead += entry.rowsRead;
    totals.statements += entry.statements;
    totals.storageDeltaBytes += entry.storageDeltaBytes;
  }
  return assertHmacRouteWindowUsage(totals);
}
