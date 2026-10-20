/**
 * P2V Cloudflare D1 REST client for Render-hosted MCP.
 * Secrets/IDs are operator environment only; never tool arguments/results.
 * Uses Cloudflare's official POST /accounts/{account_id}/d1/database/{database_id}/query.
 */
const HEX32=/^[a-f0-9]{32}$/i;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const TOKEN=/^[A-Za-z0-9._~-]{20,256}$/;
const MAX_BODY=262144;

function config(env) {
  const accountId=env?.CF_D1_ACCOUNT_ID;
  const databaseId=env?.CF_D1_DATABASE_ID;
  const apiToken=env?.CF_D1_API_TOKEN;
  if(!HEX32.test(accountId??"")||!UUID.test(databaseId??"")||!TOKEN.test(apiToken??""))
    throw Error("d1_not_configured");
  return {accountId,databaseId,apiToken};
}
function parseResult(payload) {
  if(!payload||payload.success!==true||!Array.isArray(payload.result)||payload.result.length!==1)
    throw Error("d1_api_error");
  const item=payload.result[0];
  if(item?.success!==true||!Array.isArray(item.results)) throw Error("d1_api_error");
  return item.results;
}
export function createCloudflareD1Http({env=process.env,fetchImpl=fetch,timeoutMs=8000}={}) {
  if(typeof fetchImpl!=="function"||!Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>15000)
    throw Error("invalid_d1_http_config");
  const fixed=config(env);
  const endpoint=`https://api.cloudflare.com/client/v4/accounts/${fixed.accountId}/d1/database/${fixed.databaseId}/query`;
  return Object.freeze({
    async query(sql,params=[]) {
      if(typeof sql!=="string"||sql.length<1||sql.length>12000||
        !Array.isArray(params)||params.length>16) throw Error("invalid_d1_query");
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),timeoutMs);
      try {
        const response=await fetchImpl(endpoint,{
          method:"POST",
          redirect:"error",
          signal:controller.signal,
          headers:{
            Authorization:`Bearer ${fixed.apiToken}`,
            "Content-Type":"application/json",
            Accept:"application/json"
          },
          body:JSON.stringify({sql,params})
        });
        if(!response?.ok) throw Error("d1_api_error");
        const declared=Number(response.headers?.get?.("content-length")??0);
        if(Number.isFinite(declared)&&declared>MAX_BODY)throw Error("d1_api_error");
        const text=await response.text();
        if(Buffer.byteLength(text,"utf8")>MAX_BODY)throw Error("d1_api_error");
        let payload;try{payload=JSON.parse(text)}catch{throw Error("d1_api_error")}
        return parseResult(payload);
      } catch(error) {
        if(error?.message==="invalid_d1_query"||error?.message==="d1_not_configured") throw error;
        throw Error("d1_unavailable");
      } finally {clearTimeout(timer);}
    }
  });
}
