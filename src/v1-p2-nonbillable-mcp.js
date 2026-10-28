/**
 * Nonbillable protected MCP tools for Voice V1 P2.
 * Only signed-JWT-verified server requests may create/read proposals.
 * This bridge contains NO confirm operation, provider import or quota write.
 * It is exposed only by an explicit trusted server-side dependency injection;
 * absent injection, the current staging/public MCP tool lists are unchanged.
 */
import { checkText } from "./contract.js";

export const P2_PREPARE_TOOL = "prepare_shenshu_voice";
export const P2_STATUS_TOOL = "check_shenshu_voice_proposal";
const HANDLE = /^[A-Za-z0-9_-]{43}$/;
const STATES = new Set([
  "pending_confirmation", "confirmation_in_progress", "outcome_pending",
  "completed", "unknown", "expired",
]);
const SCHEMES = Object.freeze([{ type: "oauth2", scopes: ["voice:speak"] }]);

function exactKeys(input, keys) {
  return input && typeof input === "object" && !Array.isArray(input) &&
    Object.keys(input).length === keys.length &&
    keys.every(key => Object.hasOwn(input, key));
}
function validExpiry(value) {
  return typeof value === "string" &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}
export function createV1P2NonbillableMcpTools({ broker, verifiedRequest } = {}) {
  if (!broker || typeof broker.initiate !== "function" ||
      typeof broker.status !== "function") {
    throw new Error("proposal_bridge_unavailable");
  }
  // The trusted request must be bound by the verified OAuth MCP transport,
  // never taken from tool arguments or model-visible state.
  const authorization = verifiedRequest?.headers?.authorization;
  if (typeof authorization !== "string" ||
      !/^Bearer [A-Za-z0-9_.-]+$/.test(authorization) ||
      authorization.length > 12000) {
    throw new Error("proposal_bridge_unavailable");
  }
  const trustedRequest = Object.freeze({
    headers: Object.freeze({ authorization }),
  });

  const tools = Object.freeze([{
    name: P2_PREPARE_TOOL,
    title: "Prepare one ShenShu voice proposal (no charge)",
    description: "Create a nonbillable pending voice proposal. This tool cannot generate speech, reserve paid quota or confirm a charge. The owner must separately approve in the authenticated private player.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", minLength: 1, maxLength: 800 } },
      required: ["text"],
      additionalProperties: false,
    },
    securitySchemes: SCHEMES,
    _meta: { securitySchemes: SCHEMES },
  }, {
    name: P2_STATUS_TOOL,
    title: "Check own ShenShu voice proposal",
    description: "Read the owner-scoped state of a previously prepared voice proposal. Never generates speech or confirms a charge.",
    inputSchema: {
      type: "object",
      properties: { handle: { type: "string", pattern: "^[A-Za-z0-9_-]{43}$" } },
      required: ["handle"],
      additionalProperties: false,
    },
    securitySchemes: SCHEMES,
    _meta: { securitySchemes: SCHEMES },
  }]);

  return Object.freeze({
    tools,
    async call(name, args) {
      if (name === P2_PREPARE_TOOL) {
        if (!exactKeys(args, ["text"])) throw new Error("invalid_arguments");
        let text;
        try { text = checkText(args.text); }
        catch { throw new Error("invalid_arguments"); }
        const result = await broker.initiate({ trustedRequest, text });
        if (result?.status !== "pending_confirmation" ||
            result.billable !== false ||
            !HANDLE.test(result.handle ?? "") ||
            !validExpiry(result.expiresAt)) {
          throw new Error("proposal_bridge_invalid_result");
        }
        // No principal, raw text, grant, audio or provider information in MCP result.
        return {
          content: [{
            type: "text",
            text: "已准备一条不计费语音。请在已登录的独立播放器里查看，只有本人确认后才允许生成。",
          }],
          structuredContent: {
            status: "pending_confirmation",
            handle: result.handle,
            expiresAt: result.expiresAt,
            billable: false,
            paid_voice_enabled: false,
          },
        };
      }
      if (name === P2_STATUS_TOOL) {
        if (!exactKeys(args, ["handle"]) || !HANDLE.test(args.handle)) {
          throw new Error("invalid_arguments");
        }
        const result = await broker.status({ trustedRequest, handle: args.handle });
        if (!STATES.has(result?.status) || result.billable === true) {
          throw new Error("proposal_bridge_invalid_result");
        }
        const status = { status: result.status, paid_voice_enabled: false };
        if (result.status === "pending_confirmation") {
          if (!validExpiry(result.expiresAt) || result.billable !== false) {
            throw new Error("proposal_bridge_invalid_result");
          }
          status.expiresAt = result.expiresAt;
          status.billable = false;
        }
        if (result.status === "completed") status.ready = result.ready === true;
        // Never echo the text, principal or grant, even if injected backend
        // returns extra data.
        return {
          content: [{ type: "text", text: "语音提案状态：" + result.status }],
          structuredContent: status,
        };
      }
      throw new Error("unknown_tool");
    },
  });
}
