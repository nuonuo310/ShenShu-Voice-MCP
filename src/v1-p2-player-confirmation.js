/**
 * Offline-only Voice V1 P2 player-owned confirmation candidate.
 *
 * ChatGPT MCP may create and inspect a nonbillable pending proposal, but it
 * has no route into this module. Only the authenticated first-party player can
 * render the exact proposal and submit its explicit confirmation form. The
 * POST binds the existing signed player session, exact Origin, CSRF token,
 * owner-scoped handle and immutable text digest before the shared P2 broker
 * performs one compare-and-set claim and at most one paid attempt.
 *
 * The normal server mounts this handler only through the fully gated paid
 * candidate composition. Its in-memory operation store remains a test fixture;
 * production wiring requires the sealed D1 004+005 store, durable private
 * text/audio storage and a real browser user gesture.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { checkText } from "./contract.js";
import { STAGING_RESOURCE_ORIGIN } from "./protected-resource-identity.js";
import { readPrivatePlayerSession } from "./private-web-player.js";
import {
  P2_OPERATION_ACTION,
  P2_OPERATION_STATES,
} from "./v1-p2-operation-contract.js";

export const PRIVATE_PLAYER_PENDING_PATH = "/player/pending";
export const PRIVATE_PLAYER_CONFIRM_PATH = "/player/confirm";
export const P2_PLAYER_CSRF_TTL_MS = 5 * 60 * 1000;

const CONFIRMATION_PATHS = new Set([
  PRIVATE_PLAYER_PENDING_PATH,
  PRIVATE_PLAYER_CONFIRM_PATH,
]);
const HANDLE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const DIGEST_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const CSRF_PATTERN = /^v1\.([0-9]{1,12})\.([A-Za-z0-9_-]{43})$/;
const FORM_KEYS = Object.freeze(["csrf", "handle"]);
const MAX_BODY_BYTES = 4096;
const PAGE_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; " +
  "form-action 'self'; frame-ancestors 'none'; object-src 'none'";
const PLAYER_SESSION_AUTHORITY = Symbol("shenshu.p2.player-session-authority.v1");

function isRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function nowMs(clock) {
  let value;
  try {
    value = clock();
  } catch {
    throw new Error("confirmation_clock_error");
  }
  const ms = value instanceof Date ? value.valueOf() : value;
  if (!Number.isSafeInteger(ms) || ms < 0) {
    throw new Error("confirmation_clock_error");
  }
  return ms;
}

function digestText(text) {
  return createHash("sha256").update(text, "utf8").digest("base64url");
}

function validSessionSecret(value) {
  return typeof value === "string" &&
    Buffer.byteLength(value, "utf8") >= 32 &&
    Buffer.byteLength(value, "utf8") <= 256 &&
    !/[\x00-\x1f\x7f]/.test(value);
}

function validProposal(record, principal, now) {
  if (!isRecord(record) ||
      record.version !== 1 ||
      record.action !== P2_OPERATION_ACTION ||
      record.principal !== principal ||
      !HANDLE_PATTERN.test(record.handle ?? "") ||
      !DIGEST_PATTERN.test(record.textDigest ?? "") ||
      record.origin !== STAGING_RESOURCE_ORIGIN ||
      !Number.isSafeInteger(record.textBytes) ||
      !Number.isSafeInteger(record.issuedAt) ||
      !Number.isSafeInteger(record.expiresAt) ||
      record.expiresAt <= now ||
      record.state !== P2_OPERATION_STATES.PENDING_CONFIRMATION) {
    return false;
  }
  let text;
  try {
    text = checkText(record.text);
  } catch {
    return false;
  }
  return text === record.text &&
    Buffer.byteLength(record.text, "utf8") === record.textBytes &&
    digestText(record.text) === record.textDigest;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function responseHeaders(extra = {}) {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...extra,
  };
}

function reply(res, status, headers, body) {
  res.writeHead(status, responseHeaders(headers));
  res.end(body);
}

function refuse(res, status, error) {
  reply(res, status, {
    "Content-Type": "application/json; charset=utf-8",
  }, JSON.stringify({ error }));
}

function methodNotAllowed(res, allow) {
  reply(res, 405, {
    Allow: allow,
    "Content-Type": "application/json; charset=utf-8",
  }, JSON.stringify({ error: "method_not_allowed" }));
}

function redirect(res, status, location) {
  res.writeHead(status, responseHeaders({
    Location: location,
    "Content-Type": "text/plain; charset=utf-8",
  }));
  res.end();
}

function csrfMac({ principal, handle, textDigest, expiresAtSeconds, sessionSecret }) {
  return createHmac("sha256", sessionSecret)
    .update("shenshu-p2-player-csrf-v1\0")
    .update(principal)
    .update("\0")
    .update(handle)
    .update("\0")
    .update(textDigest)
    .update("\0")
    .update(String(expiresAtSeconds))
    .digest("base64url");
}

function makeCsrfToken({ principal, record, session, now, sessionSecret }) {
  const expiresAtSeconds = Math.floor(Math.min(
    now + P2_PLAYER_CSRF_TTL_MS,
    record.expiresAt,
    session.expiresAt,
  ) / 1000);
  if (expiresAtSeconds <= Math.floor(now / 1000)) return null;
  const mac = csrfMac({
    principal,
    handle: record.handle,
    textDigest: record.textDigest,
    expiresAtSeconds,
    sessionSecret,
  });
  return "v1." + String(expiresAtSeconds) + "." + mac;
}

function validCsrfToken({
  token,
  principal,
  record,
  session,
  now,
  sessionSecret,
}) {
  const match = CSRF_PATTERN.exec(token ?? "");
  if (!match) return false;
  const expiresAtSeconds = Number(match[1]);
  const maximumExpiry = Math.floor(Math.min(
    now + P2_PLAYER_CSRF_TTL_MS,
    record.expiresAt,
    session.expiresAt,
  ) / 1000);
  if (!Number.isSafeInteger(expiresAtSeconds) ||
      expiresAtSeconds <= Math.floor(now / 1000) ||
      expiresAtSeconds > maximumExpiry) {
    return false;
  }
  const expected = csrfMac({
    principal,
    handle: record.handle,
    textDigest: record.textDigest,
    expiresAtSeconds,
    sessionSecret,
  });
  const suppliedBytes = Buffer.from(match[2], "ascii");
  const expectedBytes = Buffer.from(expected, "ascii");
  return suppliedBytes.length === expectedBytes.length &&
    timingSafeEqual(suppliedBytes, expectedBytes);
}

function sameOriginRequest(req, origin) {
  if (req?.headers?.origin !== origin) return false;
  const fetchSite = req.headers["sec-fetch-site"];
  if (fetchSite !== undefined && fetchSite !== "same-origin") return false;
  const fetchMode = req.headers["sec-fetch-mode"];
  if (fetchMode !== undefined && fetchMode !== "navigate") return false;
  return true;
}

function validFormContentType(req) {
  const value = req?.headers?.["content-type"];
  return typeof value === "string" &&
    /^application\/x-www-form-urlencoded(?:\s*;\s*charset=utf-8)?$/i.test(value);
}

async function readBoundedBody(req, limit) {
  if (!req || typeof req[Symbol.asyncIterator] !== "function") {
    throw new Error("body_unavailable");
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    if (!(chunk instanceof Uint8Array)) throw new Error("body_invalid");
    total += chunk.byteLength;
    if (total > limit) throw new Error("body_too_large");
    chunks.push(Buffer.from(chunk));
  }
  if (total === 0) throw new Error("body_invalid");
  return Buffer.concat(chunks, total);
}

function parseForm(body) {
  let params;
  try {
    params = new URLSearchParams(body.toString("utf8"));
  } catch {
    return null;
  }
  const keys = [...params.keys()];
  if (keys.length !== FORM_KEYS.length ||
      !FORM_KEYS.every(key => keys.includes(key) && params.getAll(key).length === 1)) {
    return null;
  }
  return Object.freeze({
    csrf: params.get("csrf"),
    handle: params.get("handle"),
  });
}

function renderPendingPage({ proposals, session, now, sessionSecret }) {
  const cards = proposals.length ? proposals.map(record => {
    const csrf = makeCsrfToken({
      principal: session.principal,
      record,
      session,
      now,
      sessionSecret,
    });
    if (!csrf) return "";
    return '<article class="proposal">' +
      '<p class="meta">待确认 · 有效至 ' +
      escapeHtml(new Date(record.expiresAt).toISOString()) + '</p>' +
      '<pre>' + escapeHtml(record.text) + '</pre>' +
      '<p class="warning">点击“确认生成”会消耗 1 次每日语音额度，并可能按既有第三方服务条款产生费用；实际价格以账单为准。确认后不会自动重试。</p>' +
      '<form method="post" action="' + PRIVATE_PLAYER_CONFIRM_PATH + '" autocomplete="off">' +
      '<input type="hidden" name="csrf" value="' + escapeHtml(csrf) + '">' +
      '<input type="hidden" name="handle" value="' + escapeHtml(record.handle) + '">' +
      '<button type="submit">确认生成</button>' +
      '</form></article>';
  }).join("") : '<p class="empty">当前没有待确认语音。ChatGPT 只能创建非计费建议，必须回到此页面由你本人确认。</p>';

  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex,nofollow,noarchive">' +
    '<title>沈述 · 待确认语音</title><style>' +
    ':root{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;color:#efe1cf;background:#17130f;color-scheme:dark}' +
    '*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:24px 18px;background:radial-gradient(circle at 50% 0%,#30251b 0,#17130f 55%)}' +
    'main{width:min(100%,520px);margin:0 auto}.kicker{font-size:11px;letter-spacing:.2em;color:#cbb18f}' +
    'h1{font-size:25px;margin:8px 0 14px}.intro,.empty{font-size:14px;line-height:1.65;color:#cdbca8}' +
    '.proposal{margin:16px 0;padding:18px;border:1px solid rgba(222,191,151,.28);border-radius:18px;background:rgba(35,29,24,.88)}' +
    '.meta{font-size:12px;color:#cbb18f;margin:0 0 10px}pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;line-height:1.7;color:#f7ead8}' +
    '.warning{font-size:12px;line-height:1.6;color:#e0bd8d}.note{font-size:11px;line-height:1.6;color:#9d8a76}' +
    'button{width:100%;min-height:48px;border-radius:14px;border:1px solid rgba(241,213,174,.65);font:inherit;font-weight:600;color:#2b1d13;background:linear-gradient(135deg,#f0d5ad,#c69a6b)}' +
    'a{color:#e5c69d}</style></head><body><main>' +
    '<p class="kicker">SHEN · EXPLICIT CONFIRMATION</p><h1>待确认语音</h1>' +
    '<p class="intro">只有在此页看到内容后亲自点击“确认生成”，才会进入真实付费合成。刷新、重连、ChatGPT 自动重试或 Render 重启都不会替你点击。</p>' +
    cards +
    '<p class="note">本页不使用 JavaScript，不自动提交或自动刷新。返回 <a href="/player">私有播放器</a>。</p>' +
    '</main></body></html>';
}

/**
 * Broker resolver for the player-session capability. The authority Symbol is
 * module-private, so MCP request objects, form fields and JSON cannot mint it.
 */
export function createV1P2PlayerSessionPrincipalResolver() {
  return async function resolveVerifiedPrincipal(request) {
    const principal = request?.[PLAYER_SESSION_AUTHORITY];
    if (typeof principal !== "string") throw new Error("not_authorized");
    return Object.freeze({ verified: true, subject: principal });
  };
}

function playerTrustedRequest(principal) {
  return Object.freeze({ [PLAYER_SESSION_AUTHORITY]: principal });
}

export function isPrivatePlayerConfirmationPath(pathname) {
  return CONFIRMATION_PATHS.has(pathname);
}

export function createV1P2PlayerConfirmationHandler({
  operationStore,
  broker,
  sessionSecret,
  clock = Date.now,
  origin = STAGING_RESOURCE_ORIGIN,
  maximumProposals = 10,
} = {}) {
  if (!operationStore ||
      typeof operationStore.get !== "function" ||
      typeof operationStore.listPending !== "function" ||
      !broker || typeof broker.confirm !== "function" ||
      !validSessionSecret(sessionSecret) ||
      typeof clock !== "function" ||
      origin !== STAGING_RESOURCE_ORIGIN ||
      !Number.isSafeInteger(maximumProposals) ||
      maximumProposals < 1 || maximumProposals > 20) {
    throw new Error("player_confirmation_unavailable");
  }

  function sessionFor(req) {
    try {
      return readPrivatePlayerSession(req, { sessionSecret, clock });
    } catch {
      return null;
    }
  }

  async function handlePending(req, res) {
    if (req.method !== "GET") {
      methodNotAllowed(res, "GET");
      return;
    }
    const session = sessionFor(req);
    if (!session) {
      refuse(res, 401, "login_required");
      return;
    }

    let now;
    try {
      now = nowMs(clock);
    } catch {
      refuse(res, 503, "confirmation_unavailable");
      return;
    }

    let records;
    try {
      records = await operationStore.listPending({
        principal: session.principal,
        now,
        limit: maximumProposals,
      });
    } catch {
      refuse(res, 503, "proposal_store_unavailable");
      return;
    }
    if (!Array.isArray(records) || records.length > maximumProposals ||
        records.some(record => !validProposal(record, session.principal, now))) {
      refuse(res, 503, "proposal_store_invalid");
      return;
    }
    if (records.some(record => !makeCsrfToken({
      principal: session.principal,
      record,
      session,
      now,
      sessionSecret,
    }))) {
      refuse(res, 503, "confirmation_unavailable");
      return;
    }

    reply(res, 200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": PAGE_CSP,
      "X-Frame-Options": "DENY",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), autoplay=()",
      Vary: "Cookie",
    }, renderPendingPage({ proposals: records, session, now, sessionSecret }));
  }

  async function handleConfirm(req, res) {
    if (req.method !== "POST") {
      methodNotAllowed(res, "POST");
      return;
    }
    const session = sessionFor(req);
    if (!session) {
      refuse(res, 401, "login_required");
      return;
    }
    if (!sameOriginRequest(req, origin)) {
      refuse(res, 403, "confirmation_forbidden");
      return;
    }
    if (!validFormContentType(req)) {
      refuse(res, 415, "unsupported_media_type");
      return;
    }

    let body;
    try {
      body = await readBoundedBody(req, MAX_BODY_BYTES);
    } catch (error) {
      if (error?.message === "body_too_large") {
        refuse(res, 413, "request_too_large");
      } else {
        refuse(res, 400, "invalid_request");
      }
      return;
    }
    const form = parseForm(body);
    if (!form) {
      refuse(res, 400, "invalid_request");
      return;
    }
    if (!HANDLE_PATTERN.test(form.handle ?? "") ||
        Buffer.byteLength(form.csrf ?? "", "utf8") > 128) {
      refuse(res, 404, "proposal_not_found");
      return;
    }

    let now;
    try {
      now = nowMs(clock);
    } catch {
      refuse(res, 503, "confirmation_unavailable");
      return;
    }

    let record;
    try {
      record = await operationStore.get({
        principal: session.principal,
        handle: form.handle,
      });
    } catch {
      refuse(res, 503, "proposal_store_unavailable");
      return;
    }
    // A foreign or forged handle is indistinguishable from a missing owner row.
    if (!record || record.principal !== session.principal) {
      refuse(res, 404, "proposal_not_found");
      return;
    }
    if (!isRecord(record) ||
        record.action !== P2_OPERATION_ACTION ||
        record.origin !== STAGING_RESOURCE_ORIGIN) {
      refuse(res, 503, "proposal_store_invalid");
      return;
    }
    if (record.state === P2_OPERATION_STATES.PENDING_CONFIRMATION &&
        record.expiresAt <= now) {
      refuse(res, 410, "proposal_expired");
      return;
    }
    if (!validCsrfToken({
      token: form.csrf,
      principal: session.principal,
      record,
      session,
      now,
      sessionSecret,
    })) {
      refuse(res, 403, "confirmation_forbidden");
      return;
    }

    let result;
    try {
      result = await broker.confirm({
        trustedRequest: playerTrustedRequest(session.principal),
        handle: record.handle,
        // Text never comes from the form. It is loaded from the immutable,
        // owner-scoped proposal that the player displayed before this POST.
        text: record.text,
      });
    } catch (error) {
      switch (error?.message) {
        case "operation_expired":
          refuse(res, 410, "proposal_expired");
          return;
        case "operation_pending":
          refuse(res, 409, "confirmation_in_progress");
          return;
        case "operation_outcome_unknown":
          refuse(res, 409, "provider_outcome_unknown");
          return;
        case "operation_not_found":
          refuse(res, 404, "proposal_not_found");
          return;
        case "operation_binding_mismatch":
          refuse(res, 409, "proposal_integrity_changed");
          return;
        default:
          refuse(res, 503, "confirmation_unavailable");
          return;
      }
    }
    if (result?.status !== "completed") {
      refuse(res, 503, "confirmation_unavailable");
      return;
    }
    redirect(res, 303, PRIVATE_PLAYER_PENDING_PATH + "?result=completed");
  }

  return Object.freeze({
    async handle(req, res, url) {
      const pathname = url?.pathname;
      if (!isPrivatePlayerConfirmationPath(pathname)) return false;
      try {
        if (pathname === PRIVATE_PLAYER_PENDING_PATH) {
          await handlePending(req, res);
        } else {
          await handleConfirm(req, res);
        }
      } catch {
        if (!res.headersSent) refuse(res, 503, "confirmation_unavailable");
        else if (!res.writableEnded) res.end();
      }
      return true;
    },
  });
}
