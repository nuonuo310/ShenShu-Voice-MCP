/**
 * P2M: authenticated, NON-BILLABLE MCP handshake for staged OAuth testing.
 * Disabled unless SHENSHU_AUTH_MCP_ENABLED=1 and operator-provisioned public JWKS
 * are valid. No MiniMax import, voice synthesis, quota mutation or audio output.
 *
 * Each Streamable HTTP request is separately signature/scope/audience checked;
 * no unsigned principal from tools or headers (other than bearer token) is used.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { createVerifiedIdentityResolver } from "./verified-identity.js";
import { createAuth0JwksCache } from "./auth0-jwks-cache.js";

const MAX_JWKS_BYTES=65536;

export function createStagingIdentityVerifier(env,{issuer,audience,jwksCache=null}={}) {
  if(env?.SHENSHU_AUTH_MCP_ENABLED!=="1") return null;
  try {
    // Production staging prefers live trusted JWKS retrieval; static JSON exists
    // only as an explicit test/dev fallback and is never caller supplied.
    if (jwksCache && typeof jwksCache.get==="function") {
      return async function resolveWithRotatingKeys(request) {
        const snapshot=await jwksCache.get();
        const verifier=createVerifiedIdentityResolver({
          issuer,audience,publicJwks:snapshot.keys,requiredScopes:["voice:speak"]
        });
        return verifier(request);
      };
    }
    if (env?.NODE_ENV !== "test") return null;
    const json=env?.SHENSHU_AUTH_PUBLIC_JWKS_JSON;
    if(typeof json!=="string" || Buffer.byteLength(json,"utf8")>MAX_JWKS_BYTES) return null;
    const data=JSON.parse(json);
    if(!Array.isArray(data?.keys)||data.keys.length<1||data.keys.length>10) return null;
    return createVerifiedIdentityResolver({
      issuer,audience,publicJwks:data.keys,requiredScopes:["voice:speak"]
    });
  } catch {return null;}
}

export function makeStagingMcpServer() {
  const server=new McpServer({name:"shenshu-identity-stage",version:"0.1.0"});
  server.tool("verify_shenshu_login",
    "Non-billable OAuth login handshake. Confirms authenticated access only. Generates no voice.",
    {},
    async()=>({
      content:[{type:"text",text:"身份已验证。沈述付费语音尚未开放。"}],
      structuredContent:{authenticated:true,paid_voice_enabled:false}
    })
  );
  return server;
}

/**
 * Handles an already authenticated request, or rejects it.
 * Returns no identity data to the client. Errors are generic and fail closed.
 */
export async function handleStagingAuthenticatedMcp(req,res,{
  env,issuer,audience,resourceMetadataUrl,jwksCache=null
}) {
  const challenge='Bearer resource_metadata="'+resourceMetadataUrl+'", scope="voice:speak"';
  const refuse=(status,reason, extra={})=>{
    res.writeHead(status,{
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"no-store",
      "X-Content-Type-Options":"nosniff",
      ...extra
    });
    res.end(JSON.stringify({error:reason}));
  };
  const verifier=createStagingIdentityVerifier(env,{issuer,audience,jwksCache});
  if(!verifier) {
    refuse(401,"unauthorized",{"WWW-Authenticate":challenge});
    return;
  }
  try {
    await verifier({headers:req.headers});
  } catch(error) {
    const missingScope=error?.message==="insufficient_scope";
    refuse(missingScope?403:401,missingScope?"insufficient_scope":"unauthorized",
      {"WWW-Authenticate":challenge});
    return;
  }
  if(!["POST","GET","DELETE"].includes(req.method)) {
    refuse(405,"method_not_allowed",{"Allow":"POST, GET, DELETE"});
    return;
  }
  const server=makeStagingMcpServer();
  const transport=new StreamableHTTPServerTransport({
    sessionIdGenerator:undefined,enableJsonResponse:true
  });
  res.on("close",()=>{void transport.close();void server.close()});
  try {
    await server.connect(transport);
    await transport.handleRequest(req,res);
  } catch {
    if(!res.headersSent)refuse(500,"internal_error");
  }
}
