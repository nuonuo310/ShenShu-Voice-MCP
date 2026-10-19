/**
 * STAGING ONLY. GitHub OAuth exchange and identity lookup.
 * NOT a deployed OAuth server, and NOT imported by public /mcp.
 * Call only after durable OAuth state and initiating session were verified.
 */
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const USER_URL = "https://api.github.com/user";
const CODE = /^[A-Za-z0-9_-]{8,256}$/;
const MAX_RESPONSE_BYTES = 16 * 1024;
const DEADLINE_MS = 8000;

function validateConfig({clientId,clientSecret,redirectUri,expectedRedirectUri}) {
  if (typeof clientId !== "string" || !clientId.trim() ||
      typeof clientSecret !== "string" || !clientSecret.trim() ||
      typeof expectedRedirectUri !== "string" ||
      !/^https:\/\/[A-Za-z0-9.-]+(?:\/[A-Za-z0-9/_-]*)?$/.test(expectedRedirectUri) ||
      redirectUri !== expectedRedirectUri) throw Error("github_oauth_not_configured");
}

async function jsonBounded(response, deadline) {
  if (!response?.ok || !response.body || typeof response.body.getReader !== "function")
    throw Error("upstream_unavailable");
  const reader = response.body.getReader();
  const chunks = [];
  let n = 0;
  try {
    while (true) {
      if (deadline.signal.aborted) throw Error("upstream_timeout");
      const {done,value} = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw Error("invalid_response");
      n += value.byteLength;
      if (n > MAX_RESPONSE_BYTES) throw Error("response_too_large");
      chunks.push(value);
    }
    const data = new Uint8Array(n);
    let off = 0;
    for (const chunk of chunks) { data.set(chunk,off); off += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(data));
  } finally {
    try { await reader.cancel(); } catch {}
  }
}

export async function exchangeAndVerifyGitHubUser({
  code, clientId, clientSecret, redirectUri, expectedRedirectUri,
  fetchImpl = fetch, timeoutMs = DEADLINE_MS
}) {
  validateConfig({clientId,clientSecret,redirectUri,expectedRedirectUri});
  if (typeof code !== "string" || !CODE.test(code)) throw Error("invalid_authorization_code");
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > DEADLINE_MS)
    throw Error("github_oauth_not_configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let token;
  try {
    const response = await fetchImpl(TOKEN_URL,{
      method:"POST",
      headers:{"Accept":"application/json","Content-Type":"application/json"},
      body:JSON.stringify({client_id:clientId,client_secret:clientSecret,code,redirect_uri:expectedRedirectUri}),
      signal:controller.signal
    });
    const payload = await jsonBounded(response,controller);
    if (controller.signal.aborted || typeof payload?.access_token !== "string" ||
        payload.access_token.length < 16 || payload.token_type?.toLowerCase() !== "bearer")
      throw Error("invalid_exchange");
    token = payload.access_token;
    const userResponse = await fetchImpl(USER_URL,{
      headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+token,
        "X-GitHub-Api-Version":"2022-11-28"},
      signal:controller.signal
    });
    const user = await jsonBounded(userResponse,controller);
    if (controller.signal.aborted || !Number.isSafeInteger(user?.id) || user.id < 1 ||
        typeof user.login !== "string" || !user.login)
      throw Error("invalid_user");
    return Object.freeze({subject:"github_id_"+user.id,login:user.login});
  } catch {
    throw Error("github_oauth_failed");
  } finally {
    clearTimeout(timer);
    token = undefined;
  }
}
