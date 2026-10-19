/**
 * P2 contract for paid-voice admission. Not wired to the public /mcp.
 * A production caller MUST supply independently verified identity and a
 * durable, atomic reservation store (e.g., transactional SQL). Neither a
 * prompt-supplied principal nor an in-memory map is a security boundary.
 *
 * A reservation is never refunded automatically: an uncertain MiniMax outcome
 * can have been billed. Retries with the same request ID must be denied.
 */
import { randomUUID } from "node:crypto";

const ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class PaidVoiceGate {
  constructor({ resolveVerifiedPrincipal, reserveAtomic, maximumDailyCalls = 3,
    clock = () => new Date(), makeRequestId = randomUUID }) {
    if (typeof resolveVerifiedPrincipal !== "function" || typeof reserveAtomic !== "function") {
      throw new Error("missing_security_dependency");
    }
    if (!Number.isSafeInteger(maximumDailyCalls) || maximumDailyCalls < 1 ||
      maximumDailyCalls > 20) throw new Error("invalid_budget");
    this.resolveVerifiedPrincipal = resolveVerifiedPrincipal;
    this.reserveAtomic = reserveAtomic;
    this.maximumDailyCalls = maximumDailyCalls;
    this.clock = clock;
    this.makeRequestId = makeRequestId;
  }

  async authorize({ trustedRequest, textBytes }) {
    if (!Number.isSafeInteger(textBytes) || textBytes < 1 || textBytes > 800) {
      throw new Error("invalid_text_size");
    }
    // The callback MUST verify incoming auth cryptographically and return a
    // verified server-side principal. Never accept a principal from tool args.
    const identity = await this.resolveVerifiedPrincipal(trustedRequest);
    if (!identity || identity.verified !== true || !ID_PATTERN.test(identity.subject ?? "")) {
      throw new Error("not_authorized");
    }
    const now = this.clock();
    if (!(now instanceof Date) || Number.isNaN(now.valueOf())) throw new Error("clock_error");
    const day = now.toISOString().slice(0,10);
    if (!DAY_PATTERN.test(day)) throw new Error("clock_error");
    const requestId = this.makeRequestId();
    if (!ID_PATTERN.test(requestId)) throw new Error("invalid_request_id");
    // reserveAtomic must run a durable SERIALIZABLE transaction or equivalent:
    // unique requestId + daily count check + reservation insert in ONE commit.
    // A returned grant MUST NOT be reusable across invocations.
    const result = await this.reserveAtomic({
      subject: identity.subject,
      day,
      requestId,
      limit: this.maximumDailyCalls,
    });
    if (result?.reserved !== true) throw new Error("budget_denied");
    return Object.freeze({
      allowed: true,
      principal: identity.subject,
      oneTime: true,
      requestId,
    });
  }
}
