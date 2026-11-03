/**
 * Read-only owner view for nonbillable P2 proposals.
 *
 * The page is intentionally inert: no form, script, refresh, auto-submit or
 * paid confirmation path. It reads the existing signed player session and an
 * owner-scoped operation store, then renders the exact proposal text and
 * expiry. There is no provider, quota or audio dependency.
 */
import { readPrivatePlayerSession } from "./private-web-player.js";
import {
  P2_OPERATION_STATES,
  validRecord,
} from "./v1-p2-operation-contract.js";
import { STAGING_RESOURCE_ORIGIN } from "./protected-resource-identity.js";

export const PRIVATE_PLAYER_PENDING_PATH = "/player/pending";

const PAGE_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; " +
  "form-action 'none'; frame-ancestors 'none'; object-src 'none'";

function validSessionSecret(value) {
  return typeof value === "string" &&
    Buffer.byteLength(value, "utf8") >= 32 &&
    Buffer.byteLength(value, "utf8") <= 256 &&
    !/[\x00-\x1f\x7f]/.test(value);
}

function nowMs(clock) {
  let value;
  try {
    value = clock();
  } catch {
    throw new Error("pending_clock_error");
  }
  const ms = value instanceof Date ? value.valueOf() : value;
  if (!Number.isSafeInteger(ms) || ms < 0) throw new Error("pending_clock_error");
  return ms;
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

function renderPage({ proposals }) {
  const cards = proposals.length ? proposals.map(record =>
    '<article class="proposal">' +
      '<p class="meta">待确认 · 有效至 ' +
        escapeHtml(new Date(record.expiresAt).toISOString()) + '</p>' +
      '<p class="state">尚未生成</p>' +
      '<pre>' + escapeHtml(record.text) + '</pre>' +
    '</article>'
  ).join("") :
    '<p class="empty">当前没有本人待确认的非计费语音提案。</p>';

  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex,nofollow,noarchive">' +
    '<title>沈述 · 非计费待确认</title><style>' +
    ':root{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;color:#efe1cf;background:#17130f;color-scheme:dark}' +
    '*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:24px 18px;background:radial-gradient(circle at 50% 0%,#30251b 0,#17130f 55%)}' +
    'main{width:min(100%,520px);margin:0 auto}.kicker{font-size:11px;letter-spacing:.2em;color:#cbb18f}' +
    'h1{font-size:25px;margin:8px 0 14px}.intro,.empty{font-size:14px;line-height:1.65;color:#cdbca8}' +
    '.proposal{margin:16px 0;padding:18px;border:1px solid rgba(222,191,151,.28);border-radius:18px;background:rgba(35,29,24,.88)}' +
    '.meta{font-size:12px;color:#cbb18f;margin:0 0 10px}.state{margin:0 0 10px;font-size:12px;color:#e0bd8d}' +
    'pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;line-height:1.7;color:#f7ead8}' +
    '.note{font-size:11px;line-height:1.6;color:#9d8a76}a{color:#e5c69d}' +
    '</style></head><body><main>' +
    '<p class="kicker">SHEN · READ-ONLY PREVIEW</p><h1>非计费待确认</h1>' +
    '<p class="intro">这里只显示本人已准备的非计费语音提案。当前为只读预览，未开启实际生成；页面没有确认按钮，也不会调用 MiniMax 或产生费用。</p>' +
    cards +
    '<p class="note">本页不自动刷新、不自动提交。返回 <a href="/player">私有播放器</a>。</p>' +
    '</main></body></html>';
}

export function isPrivatePlayerPendingPath(pathname) {
  return pathname === PRIVATE_PLAYER_PENDING_PATH;
}

export function createV1P2ReadonlyPlayerPendingHandler({
  operationStore,
  sessionSecret,
  clock = Date.now,
  origin = STAGING_RESOURCE_ORIGIN,
  maximumProposals = 10,
} = {}) {
  if (!operationStore ||
      typeof operationStore.listPending !== "function" ||
      !validSessionSecret(sessionSecret) ||
      typeof clock !== "function" ||
      origin !== STAGING_RESOURCE_ORIGIN ||
      !Number.isSafeInteger(maximumProposals) ||
      maximumProposals < 1 || maximumProposals > 20) {
    throw new Error("player_pending_unavailable");
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
      reply(res, 405, {
        Allow: "GET",
        "Content-Type": "application/json; charset=utf-8",
      }, JSON.stringify({ error: "method_not_allowed" }));
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
      refuse(res, 503, "pending_unavailable");
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
        records.some(record => !validRecord(record) ||
          record.principal !== session.principal ||
          record.state !== P2_OPERATION_STATES.PENDING_CONFIRMATION ||
          record.expiresAt <= now)) {
      refuse(res, 503, "proposal_store_invalid");
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
    }, renderPage({ proposals: records }));
  }

  return Object.freeze({
    async handle(req, res, url) {
      if (!isPrivatePlayerPendingPath(url?.pathname)) return false;
      try {
        await handlePending(req, res);
      } catch {
        if (!res.headersSent) refuse(res, 503, "pending_unavailable");
        else if (!res.writableEnded) res.end();
      }
      return true;
    },
  });
}
