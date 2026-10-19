/**
 * Post-verification policy for an authenticated paid voice resource server.
 * This is NOT an OAuth verifier or authentication endpoint.
 * Only call with a token-verifier-produced identity context. Untrusted tool
 * arguments must never be passed as the identity context.
 */
const SUBJECT = /^[A-Za-z0-9:_-]{8,180}$/;
const SCOPE = "voice:generate";
const MIN_EXPIRY_MARGIN_SECONDS = 10;
export const VOICE_GENERATE_SCOPE = SCOPE;

export function verifyPaidVoicePolicy({
  identity,
  approvedSubject,
  expectedIssuer,
  expectedAudience,
  nowSeconds = Math.floor(Date.now() / 1000),
}) {
  if (!SUBJECT.test(approvedSubject ?? "") ||
      typeof expectedIssuer !== "string" || !expectedIssuer.startsWith("https://") ||
      typeof expectedAudience !== "string" || !expectedAudience.startsWith("https://")) {
    throw new Error("identity_policy_not_configured");
  }
  // The cryptographic authenticator must supply a verified claim set and
  // pin trust to issuer + resource audience before reaching this policy.
  // This flag is not a token; client-supplied values are never acceptable.
  if (identity?.verified !== true ||
      identity?.source !== "trusted_oauth_resource_middleware" ||
      identity.subject !== approvedSubject ||
      identity.issuer !== expectedIssuer ||
      identity.audience !== expectedAudience ||
      !Number.isSafeInteger(identity.expiresAt) ||
      identity.expiresAt <= nowSeconds + MIN_EXPIRY_MARGIN_SECONDS ||
      !Array.isArray(identity.scopes) || !identity.scopes.includes(SCOPE)) {
    throw new Error("not_authorized");
  }
  return Object.freeze({subject: identity.subject, scope: SCOPE});
}
