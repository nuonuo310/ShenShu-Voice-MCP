import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  HMAC_ROUTE_BUDGET_CAPS,
  HMAC_ROUTE_WINDOW_PLAN,
  assertHmacRouteWindowUsage,
  summarizeHmacRouteWindowPlan,
} from "./fixtures/hmac-route-window-budget.mjs";

test("the offline plan proves the 24/18/10 request split and complete caps", () => {
  const summary = summarizeHmacRouteWindowPlan();
  assert.deepEqual(summary, {
    workerHttpRequests: 24,
    d1TouchingRequests: 18,
    admissionRequests: 10,
    acceptedAdmissions: 4,
    rowWriteUnits: 19,
    rowsRead: 166,
    statements: 38,
    storageDeltaBytes: 28 * 1024,
    durationMs: 20 * 60 * 1000,
    providerCalls: 0,
  });
  for (const [name, cap] of Object.entries(HMAC_ROUTE_BUDGET_CAPS)) {
    assert.ok(summary[name] <= cap, name);
  }
  assert.equal(summary.workerHttpRequests, HMAC_ROUTE_BUDGET_CAPS.workerHttpRequests);
  assert.equal(summary.d1TouchingRequests, HMAC_ROUTE_BUDGET_CAPS.d1TouchingRequests);
  assert.equal(summary.admissionRequests, HMAC_ROUTE_BUDGET_CAPS.admissionRequests);
  assert.equal(summary.acceptedAdmissions, HMAC_ROUTE_BUDGET_CAPS.acceptedAdmissions);
});

test("budget accounting rejects every overrun and provider call", () => {
  const summary = summarizeHmacRouteWindowPlan();
  for (const [name, cap] of Object.entries(HMAC_ROUTE_BUDGET_CAPS)) {
    if (name === "providerCalls") continue;
    assert.throws(() => assertHmacRouteWindowUsage({ ...summary, [name]: cap + 1 }), {
      message: "hmac_route_plan_invalid",
    }, name);
  }
  assert.throws(() => assertHmacRouteWindowUsage({
    ...summary,
    providerCalls: 1,
  }), { message: "hmac_route_plan_invalid" });
  assert.throws(() => assertHmacRouteWindowUsage({ ...summary, secret: "nope" }), {
    message: "hmac_route_plan_invalid",
  });
});

test("the plan cannot smuggle an extra request, provider field or duplicate id", () => {
  const extra = {
    ...HMAC_ROUTE_WINDOW_PLAN.operations[0],
    id: "N99_extra_request",
  };
  assert.throws(() => summarizeHmacRouteWindowPlan({
    ...HMAC_ROUTE_WINDOW_PLAN,
    operations: [...HMAC_ROUTE_WINDOW_PLAN.operations, extra],
  }), { message: "hmac_route_plan_invalid" });

  const providerField = {
    ...HMAC_ROUTE_WINDOW_PLAN.operations[0],
    providerCalls: 1,
  };
  assert.throws(() => summarizeHmacRouteWindowPlan({
    ...HMAC_ROUTE_WINDOW_PLAN,
    operations: [providerField, ...HMAC_ROUTE_WINDOW_PLAN.operations.slice(1)],
  }), { message: "hmac_route_plan_invalid" });

  const duplicate = {
    ...HMAC_ROUTE_WINDOW_PLAN.operations[1],
    id: HMAC_ROUTE_WINDOW_PLAN.operations[0].id,
  };
  assert.throws(() => summarizeHmacRouteWindowPlan({
    ...HMAC_ROUTE_WINDOW_PLAN,
    operations: [
      HMAC_ROUTE_WINDOW_PLAN.operations[0],
      duplicate,
      ...HMAC_ROUTE_WINDOW_PLAN.operations.slice(2),
    ],
  }), { message: "hmac_route_plan_invalid" });
});

test("the fixture is offline-only and contains no secret, URL or provider path", () => {
  const source = readFileSync(
    new URL("./fixtures/hmac-route-window-budget.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /from\s+["']node:|fetch\s*\(\s*["']https?:/);
  assert.doesNotMatch(JSON.stringify(HMAC_ROUTE_WINDOW_PLAN),
    /https?:\/\/|secret|token|authorization|bearer|minimax/i);
});
