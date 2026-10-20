/**
 * P2E OFFLINE: validate OAuth authorization-server discovery from an
 * operator-configured issuer. No remote fetching, no dynamic discovery from
 * attacker input, no credentials, no calls to MiniMax.
 *
 * This checks only metadata shape; it does not implement login or imply
 * compatibility with a specific OAuth vendor.
 */
function httpsUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" &&
      !parsed.username && !parsed.password && !parsed.search &&
      !parsed.hash && Boolean(parsed.hostname) &&
      !parsed.hostname.endsWith(".invalid");
  } catch { return false; }
}
function isArrayOfStrings(value) {
  return Array.isArray(value) && value.every(x => typeof x === "string");
}

export function validateAuthorizationServerMetadata(metadata, { expectedIssuer }) {
  if (!httpsUrl(expectedIssuer) || !metadata ||
      typeof metadata !== "object" || Array.isArray(metadata))
    throw new Error("invalid_authorization_server");
  if (metadata.issuer !== expectedIssuer) throw new Error("issuer_mismatch");
  for (const field of ["authorization_endpoint","token_endpoint","jwks_uri"]) {
    if (!httpsUrl(metadata[field])) throw new Error("invalid_authorization_server");
  }
  if (!isArrayOfStrings(metadata.response_types_supported) ||
      !metadata.response_types_supported.includes("code"))
    throw new Error("unsupported_authorization_flow");
  if (!isArrayOfStrings(metadata.code_challenge_methods_supported) ||
      !metadata.code_challenge_methods_supported.includes("S256"))
    throw new Error("pkce_s256_required");
  if (metadata.grant_types_supported !== undefined &&
      (!isArrayOfStrings(metadata.grant_types_supported) ||
        !metadata.grant_types_supported.includes("authorization_code")))
    throw new Error("unsupported_authorization_flow");
  // The selected vendor must support an agreed ChatGPT client-registration
  // route: either DCR, Client ID Metadata Documents, or pre-registration.
  // This property intentionally does not assert that the vendor supports one.
  return Object.freeze({
    issuer: metadata.issuer,
    authorizationEndpoint: metadata.authorization_endpoint,
    tokenEndpoint: metadata.token_endpoint,
    jwksUri: metadata.jwks_uri,
    supportsDynamicRegistration: httpsUrl(metadata.registration_endpoint),
    advertisesClientIdMetadata: isArrayOfStrings(metadata.client_id_metadata_document_supported)
      ? metadata.client_id_metadata_document_supported.includes("true")
      : metadata.client_id_metadata_document_supported === true,
    pkceS256: true,
    authorizationCode: true,
  });
}
