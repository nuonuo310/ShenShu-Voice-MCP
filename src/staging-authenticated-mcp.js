/**
 * P2M: authenticated, NON-BILLABLE MCP handshake for staged OAuth testing.
 * Disabled unless SHENSHU_AUTH_MCP_ENABLED=1 and operator-provisioned public JWKS
 * are valid. No MiniMax import, voice synthesis, quota mutation or audio output.
 *
 * Each Streamable HTTP request is separately signature/scope/audience checked;
 * no unsigned principal from tools or headers (other than bearer token) is used.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createVerifiedIdentityResolver } from "./verified-identity.js";
import { createAuth0JwksCache } from "./auth0-jwks-cache.js";
import { createD1AdmissionDryRun } from "./d1-admission-dry-run.js";
import { preparePrivateFixtureAudio } from "./private-fixture-delivery.js";
import { makeInlineToneFixture } from "./inline-fixture.js";

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
          issuer,audience,publicJwks:snapshot.keys,requiredScopes:["voice:speak"],maxLifetimeSeconds:86400
        });
        return verifier(request);
      };
    }
    if (env?.SHENSHU_AUTH_STATIC_JWKS_TEST_ONLY !== "1") return null;
    const json=env?.SHENSHU_AUTH_PUBLIC_JWKS_JSON;
    if(typeof json!=="string" || Buffer.byteLength(json,"utf8")>MAX_JWKS_BYTES) return null;
    const data=JSON.parse(json);
    if(!Array.isArray(data?.keys)||data.keys.length<1||data.keys.length>10) return null;
    return createVerifiedIdentityResolver({
      issuer,audience,publicJwks:data.keys,requiredScopes:["voice:speak"],maxLifetimeSeconds:86400
    });
  } catch {return null;}
}

export function makeStagingMcpServer({verifiedSubject,admissionDryRun=null,privateFixtureEnabled=false}={}) {
  if(typeof verifiedSubject!=="string" || verifiedSubject.length<8) throw Error("missing_verified_subject");
  const server=new Server(
    {name:"shenshu-identity-stage",version:"0.2.0"},
    {capabilities:{tools:{}}}
  );
  const oauth=[{type:"oauth2",scopes:["voice:speak"]}];
  const tools=[{
    name:"verify_shenshu_login",
    title:"Verify ShenShu OAuth login",
    description:"Non-billable OAuth login handshake. Confirms authenticated access only. Generates no voice.",
    inputSchema:{type:"object",properties:{},additionalProperties:false},
    outputSchema:{
      type:"object",
      properties:{
        authenticated:{type:"boolean"},
        paid_voice_enabled:{type:"boolean"}
      },
      required:["authenticated","paid_voice_enabled"],
      additionalProperties:false
    },
    securitySchemes:oauth,
    _meta:{securitySchemes:oauth}
  }];
  if(typeof admissionDryRun==="function") {
    tools.push({
      name:"verify_shenshu_d1_admission",
      title:"Verify ShenShu D1 admission gate",
      description:"Non-billable dry-run of the real Cloudflare D1 quota and one-time grant path. Uses a separate dry-run quota namespace and never calls MiniMax.",
      inputSchema:{type:"object",properties:{},additionalProperties:false},
      outputSchema:{
        type:"object",
        properties:{
          admission_verified:{type:"boolean"},
          paid_voice_enabled:{type:"boolean"},
          real_quota_consumed:{type:"boolean"}
        },
        required:["admission_verified","paid_voice_enabled","real_quota_consumed"],
        additionalProperties:false
      },
      securitySchemes:oauth,
      _meta:{securitySchemes:oauth}
    });
  }
  if(privateFixtureEnabled) tools.push({
    name:"preview_private_fixture",
    title:"Preview authenticated non-billable audio fixture",
    description:"Returns a fixed short synthetic tone only after OAuth authentication. No MiniMax, no paid quota, no public audio URL.",
    inputSchema:{type:"object",properties:{},additionalProperties:false},
    securitySchemes:oauth,_meta:{securitySchemes:oauth}
  });
  server.setRequestHandler(ListToolsRequestSchema,async()=>({tools}));
  server.setRequestHandler(CallToolRequestSchema,async request=>{
    const args=request.params.arguments;
    if(args!==undefined && (
      args===null || typeof args!=="object" || Array.isArray(args) ||
      Object.keys(args).length!==0
    )) throw new Error("invalid_arguments");
    if(request.params.name==="verify_shenshu_login") {
      return {
        content:[{type:"text",text:"身份已验证。沈述付费语音尚未开放。"}],
        structuredContent:{authenticated:true,paid_voice_enabled:false}
      };
    }
    if(request.params.name==="verify_shenshu_d1_admission" && typeof admissionDryRun==="function") {
      const result=await admissionDryRun({verifiedSubject});
      return {
        content:[{type:"text",text:"D1 额度与一次性授权门禁已通过 dry-run；未调用 MiniMax。"}],
        structuredContent:result
      };
    }
    if(request.params.name==="preview_private_fixture" && privateFixtureEnabled) {
      const record=await preparePrivateFixtureAudio({
        text:"这是授权测试提示音，不是沈述语音。",
        trustedRequest:null,
        authorize:async()=>({authenticated:true,allowed:true}),
        loadFixture:()=>Buffer.from(makeInlineToneFixture().audioBase64,"base64")
      });
      return {content:[{type:"text",text:"授权测试提示音（非语音合成，未调用 MiniMax）。"}],structuredContent:{record:{id:"private_fixture_001",title:"授权音频测试",voiceLabel:"测试音频",...record}}};
    }
    throw new Error("unknown_tool");
  });
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
  let verifiedIdentity;
  try {
    verifiedIdentity=await verifier({headers:req.headers});
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
  const admissionDryRun=createD1AdmissionDryRun({env});
  const server=makeStagingMcpServer({verifiedSubject:verifiedIdentity.subject,admissionDryRun,
    privateFixtureEnabled:env.SHENSHU_PRIVATE_FIXTURE_ENABLED==="1"});
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
