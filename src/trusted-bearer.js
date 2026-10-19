/** Stage-only HTTP authorization extraction for a private MCP ingress.
 * Never accept bearer credentials from MCP tool arguments, URL, cookies or
 * query strings. This function is not imported by the public preview server.
 */
export function extractTrustedBearer(request) {
  if (!request || typeof request.headers?.get !== "function") throw Error("not_authorized");
  const url = new URL(request.url);
  if (url.searchParams.has("access_token") || url.searchParams.has("token") ||
      url.searchParams.has("authorization")) throw Error("not_authorized");
  const auth = request.headers.get("authorization");
  if (typeof auth !== "string" || !/^Bearer [A-Za-z0-9._~-]{24,8192}$/.test(auth))
    throw Error("not_authorized");
  return auth.slice(7);
}
