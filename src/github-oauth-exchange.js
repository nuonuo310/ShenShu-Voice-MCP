/**
 * GitHub OAuth code exchange and authenticated user lookup.
 * STAGING ONLY. The returned GitHub access token MUST NOT be sent to clients,
 * tool results, logs, or persistent records. This module does not issue MCP
 * tokens, verify OAuth state, or create a paid endpoint.
 */
const TOKEN_URL="https://github.com/login/oauth/access_token";
const USER_URL="https://api.github.com/user";
const CODE=/^[A-Za-z0-9_-]{8,256}$/;
function requireConfig(clientId,clientSecret,redirectUri){
 if(typeof clientId!=="string"||!clientId.trim()||
    typeof clientSecret!=="string"||!clientSecret.trim()||
    typeof redirectUri!=="string"||!redirectUri.startsWith("https://"))
    throw Error("github_oauth_not_configured");
}
export async function exchangeAndVerifyGitHubUser({
 code,clientId,clientSecret,redirectUri,fetchImpl=fetch
}){
 requireConfig(clientId,clientSecret,redirectUri);
 if(typeof code!=="string"||!CODE.test(code))throw Error("invalid_authorization_code");
 let token;
 try{
  const res=await fetchImpl(TOKEN_URL,{
   method:"POST",
   headers:{"Accept":"application/json","Content-Type":"application/json"},
   body:JSON.stringify({client_id:clientId,client_secret:clientSecret,code,redirect_uri:redirectUri})
  });
  if(!res.ok)throw Error("exchange_failed");
  const body=await res.json();
  if(typeof body.access_token!=="string"||body.access_token.length<16||
     body.token_type?.toLowerCase()!=="bearer")throw Error("exchange_failed");
  token=body.access_token;
  const userRes=await fetchImpl(USER_URL,{
   headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+token,
    "X-GitHub-Api-Version":"2022-11-28"}
  });
  if(!userRes.ok)throw Error("user_lookup_failed");
  const user=await userRes.json();
  // Numeric GitHub ID is less mutable than a login or email address.
  if(!Number.isSafeInteger(user.id)||user.id<1||typeof user.login!=="string")
   throw Error("user_lookup_failed");
  return Object.freeze({subject:"github_id_"+user.id,login:user.login});
 }catch{
  throw Error("github_oauth_failed");
 }finally{
  token=undefined;
 }
}
