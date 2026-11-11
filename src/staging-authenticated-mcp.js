import {createCollectionTools} from './private-voice-collection.js';
import {buildDesktopSilverUi} from './desktop-silver-ui.js';
/**
 * P2M: authenticated, NON-BILLABLE MCP handshake for staged OAuth testing.
 * Disabled unless SHENSHU_AUTH_MCP_ENABLED=1 and operator-provisioned public JWKS
 * are valid. No MiniMax import, voice synthesis, quota mutation or audio output.
 *
 * Each Streamable HTTP request is separately signature/scope/audience checked;
 * no unsigned principal from tools or headers (other than bearer token) is used.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { readFileSync } from "node:fs";
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createVerifiedIdentityResolver } from "./verified-identity.js";
import { createV1P2NonbillableMcpTools } from "./v1-p2-nonbillable-mcp.js";
import { createAuth0JwksCache } from "./auth0-jwks-cache.js";
import { createD1AdmissionDryRun } from "./d1-admission-dry-run.js";
import { preparePrivateFixtureAudio } from "./private-fixture-delivery.js";
import { makeInlineToneFixture } from "./inline-fixture.js";
import {desktop04CapacityDescriptor,desktop04CapacityResult,V1_DESKTOP_04_CAPACITY_NAME} from "./v1-desktop-04-nonbillable-capacity.js";
import {DESKTOP_04_UI_RESOURCE} from "./v1-desktop-04-app-surface-offline.js";
import {
  makeNonbillableGeneratedHostToolResult,
  PROPOSED_GENERATED_HOST_TOOL_NAME
} from "./generated-host-delivery-candidate.js";

const MAX_JWKS_BYTES=65536;
const PRIVATE_FIXTURE_UI_URI="ui://shenshu/private-fixture-bubble-v2.html";
const privateFixtureUi=readFileSync(new URL("../ui/mcp-bubble.html",import.meta.url),"utf8");
// Server-side exact resource specialization, not an iframe URL heuristic.
const oauthBridgeUi=privateFixtureUi.replace('const isOAuthBubble=window.location.href.includes("private-fixture-bubble-v1");','const isOAuthBubble=true;');
if(oauthBridgeUi===privateFixtureUi)throw Error("oauth_bridge_ui_specialization_missing");
// Stable nonsecret UI diagnostic marker, derived from the exact HTML served by this process.
const OAUTH_UI_BUILD_MARKER="v6-host-smoke-20261021";
const oauthUiWithMarker=oauthBridgeUi.replace("</body>",'<p id="oauth-ui-build" style="font-size:11px;opacity:.55">UI '+OAUTH_UI_BUILD_MARKER+'</p></body>');
if(oauthUiWithMarker===oauthBridgeUi)throw Error("oauth_ui_marker_injection_failed");
// Dedicated resource prevents a cached diagnostic card from becoming the daily UI.
const desktop04Ui=oauthBridgeUi
  .replace('const isDesktop04Bubble=false;','const isDesktop04Bubble=true;')
  .replace('沈述 04 · 本人确认','听哥哥说话 · 04')
  .replace('确认后可能产生一次 MiniMax 费用。每份提案只能使用一次，失败不自动重试。',
    '确认后生成一次语音并计费。每天最多 1 段，北京时间 08:00 更新额度。重复播放不会重新计费。')
  .replace('确认生成这段 04 语音（可能计费）','确认生成这一段（计费）')
  .replace('等待 MCP 工具结果…','正在准备语音…')
  .replaceAll('04 语音准备成功；正在检查能否安全交付。','正在准备确认卡，尚未生成语音。')
  .replaceAll('正在检查官端私有数据通道（非计费）；尚未生成。','正在检查，尚未生成语音…')
  .replaceAll('小数据已通过，正在检查大音频传输容量（非计费）…','正在完成播放准备…')
  .replaceAll('私有数据大小与通道检查均通过（非计费）；可本人确认一次生成。','准备好了。确认后生成一次，随后点上方播放。')
  .replaceAll('沈述 04 已授权生成结果送达；请点击播放并确认是否出声。','04 已准备好。当前页面可重复播放，刷新后可能失效。')
  .replaceAll('已提交一次确认；正在等待返回（请勿重试）。','正在生成这一段，请稍等，不用重复点击。')
  .replaceAll('04 音频已返回界面；请点击上方播放并确认实际有声。','04 已准备好，点上方播放即可。')
  .replaceAll('正在解码已授权 04 音频…','正在准备播放…')
  .replaceAll('04 音频源已启动，请确认电脑是否真正听到声音。','播放中。')
  .replaceAll('04 音频播放结束（是否真正听见仍以本人确认为准）。','播放结束，可以再听一遍。');
if(desktop04Ui===oauthBridgeUi)throw Error("desktop04_ui_specialization_missing");

export function createStagingIdentityVerifier(env,{issuer,audience,jwksCache=null}={}) {
  if(env?.SHENSHU_AUTH_MCP_ENABLED!=="1") return null;
  // An explicit test-only static key set must never authenticate a production
  // process, even when the flag was misconfigured. Rotating JWKS still works.
  if(env?.NODE_ENV==="production"&&env?.SHENSHU_AUTH_STATIC_JWKS_TEST_ONLY==="1") return null;
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

export function makeStagingMcpServer({verifiedSubject,admissionDryRun=null,privateFixtureEnabled=false,proposalTools=null,desktop04Tools=null,voiceCollection=null,silverUi=false}={}) {
  if(typeof verifiedSubject!=="string" || verifiedSubject.length<8) throw Error("missing_verified_subject");
  const server=new Server(
    {name:"shenshu-identity-stage",version:"0.2.0"},
    {capabilities:{tools:{},resources:{}}}
  );
  const collectionTools=voiceCollection&&desktop04Tools&&silverUi?createCollectionTools({collection:voiceCollection,principal:verifiedSubject}):null;
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
    securitySchemes:oauth,_meta:{securitySchemes:oauth,ui:{resourceUri:PRIVATE_FIXTURE_UI_URI}}
  });
  if(privateFixtureEnabled) tools.push({
    name:"preview_oauth_hosted_tone_control",
    title:"OAuth public HTTPS WAV diagnostic control",
    description:"OAuth-gated tool displaying an already-public fixed synthetic WAV over HTTPS, using the SAME private UI resource. This audio is public test data, not private speech; no MiniMax or D1.",
    inputSchema:{type:"object",properties:{},additionalProperties:false},
    securitySchemes:oauth,_meta:{securitySchemes:oauth,ui:{resourceUri:PRIVATE_FIXTURE_UI_URI}}
  });
  // Nonsecret bridge probe. App-only visibility: not offered as a model tool by compliant hosts.
  if(privateFixtureEnabled) tools.push({
    name:"probe_oauth_ui_bridge",
    title:"Check OAuth MCP Apps host bridge",
    description:"Nonbillable authenticated UI-to-host-to-server bridge probe; returns booleans only.",
    inputSchema:{type:"object",properties:{},additionalProperties:false},
    securitySchemes:oauth,_meta:{securitySchemes:oauth,ui:{visibility:["app"]}}
  });
  // Fixed nonbillable WAV bytes through the authenticated host bridge; no public audio URL.
  if(privateFixtureEnabled) tools.push({
    name:"probe_oauth_bridge_audio_payload",
    title:"Check OAuth bridge fixed audio payload",
    description:"App-only nonbillable fixed synthetic WAV payload for transport diagnosis. No MiniMax or quota.",
    inputSchema:{type:"object",properties:{},additionalProperties:false},
    securitySchemes:oauth,_meta:{securitySchemes:oauth,ui:{visibility:["app"]}}
  });
  if(privateFixtureEnabled) tools.push({
    name:PROPOSED_GENERATED_HOST_TOOL_NAME,
    title:"Check OAuth generated-shape host delivery",
    description:"App-only NONBILLABLE TEST synthetic generated-shape WAV for MCP Apps host delivery diagnosis. No MiniMax or D1.",
    inputSchema:{type:"object",properties:{},additionalProperties:false},
    securitySchemes:oauth,_meta:{securitySchemes:oauth,ui:{visibility:["app"]}}
  });
  // Fully nonbillable app-only capacity check exists independently of the
  // dormant paid desktop04 factory. Only the authenticated private fixture
  // staging surface can expose it; no environment credential or D1 required.
  if(privateFixtureEnabled && desktop04Tools===null)tools.push(desktop04CapacityDescriptor());
  if(proposalTools!==null) {
    if(!proposalTools || !Array.isArray(proposalTools.tools) ||
       typeof proposalTools.call!=="function" ||
       proposalTools.tools.length!==2) throw Error("proposal_bridge_unavailable");
    tools.push(...proposalTools.tools);
  }
  // Dormant, server-injected only; no mere environment flag can mount a paid tool.
  if(desktop04Tools!==null){
    if(!privateFixtureEnabled||!desktop04Tools||
      !Array.isArray(desktop04Tools.tools)||![3,4].includes(desktop04Tools.tools.length)||
      (desktop04Tools.tools.length===4&&desktop04Tools.tools[3]?.name!=="speak_shenshu_desktop_04")||
      typeof desktop04Tools.call!=="function"||
      desktop04Tools.tools[0]?.name!=="prepare_shenshu_desktop_04"||
      desktop04Tools.tools[1]?.name!=="confirm_shenshu_desktop_04"||
      desktop04Tools.tools[2]?.name!=="probe_shenshu_desktop_04_capacity"||
      desktop04Tools.tools[1]?._meta?.ui?.visibility?.length!==1||
      desktop04Tools.tools[1]._meta.ui.visibility[0]!=="app"||
      desktop04Tools.tools[2]?._meta?.ui?.visibility?.length!==1||
      desktop04Tools.tools[2]._meta.ui.visibility[0]!=="app") {
      throw new Error("desktop04_tools_unavailable");
    }
    tools.push(...desktop04Tools.tools);
  }
  if(collectionTools)tools.push(...collectionTools.tools);
  server.setRequestHandler(ListResourcesRequestSchema,async()=>({resources:privateFixtureEnabled?[
    {uri:PRIVATE_FIXTURE_UI_URI,name:"ShenShu private fixture bubble",mimeType:RESOURCE_MIME_TYPE},
    ...(desktop04Tools?[{uri:DESKTOP_04_UI_RESOURCE,name:"沈述 04 语音",mimeType:RESOURCE_MIME_TYPE}]:[])
  ]:[]}));
  server.setRequestHandler(ReadResourceRequestSchema,async request=>{
    const desktop=desktop04Tools!==null&&request.params.uri===DESKTOP_04_UI_RESOURCE;
    if(!privateFixtureEnabled||(!desktop&&request.params.uri!==PRIVATE_FIXTURE_UI_URI))throw Error("unknown_resource");
    const desktopUi=desktop04Tools?.tools.length===4?
      desktop04Ui.replaceAll('每天最多 1 段','每天最多 10 条'):desktop04Ui;
    return {contents:[{uri:request.params.uri,mimeType:RESOURCE_MIME_TYPE,text:desktop?(silverUi?buildDesktopSilverUi(desktopUi,{collectionEnabled:!!collectionTools}):desktopUi):oauthUiWithMarker,
      _meta:{ui:{prefersBorder:false,csp:{connectDomains:[],resourceDomains:["https://shenshu-voice-mcp.onrender.com"]}}}}]};
  });
  server.setRequestHandler(ListToolsRequestSchema,async()=>({tools}));
  server.setRequestHandler(CallToolRequestSchema,async request=>{
    const args=request.params.arguments;
    if(proposalTools && proposalTools.tools.some(tool=>tool.name===request.params.name)) {
      return proposalTools.call(request.params.name,args);
    }
    if(collectionTools&&collectionTools.tools.some(t=>t.name===request.params.name))return collectionTools.call(request.params.name,args);
    if(desktop04Tools && desktop04Tools.tools.some(tool=>tool.name===request.params.name)) {
      const result=await desktop04Tools.call(request.params.name,args);
      // Successful audio has already passed the original generation chain.
      // Receipt issuance cannot throw away it or cause a second provider call.
      if(collectionTools&&request.params.name==='confirm_shenshu_desktop_04'&&result.structuredContent?.status==='audio_ready'){
        try{return {...result,_meta:{...result._meta,shenshuCollection:{receipt:voiceCollection.issueReceipt(verifiedSubject,result._meta.shenshuPrivateAudio.record),saved:false}}};}catch{}
      }
      return result;
    }
    if(args!==undefined && (
      args===null || typeof args!=="object" || Array.isArray(args) ||
      Object.keys(args).length!==0
    )) throw new Error("invalid_arguments");
    if(request.params.name==="verify_shenshu_login") {
      return {
        content:[{type:"text",text:desktop04Tools?.tools.length===4 ? "身份已验证。已启用按请求生成04语音，每天最多10条，无需再次确认；普通聊天不生成。" : desktop04Tools ? "身份已验证。04 语音仅在卡片内确认后生成。" : "身份已验证。沈述付费语音尚未开放。"}],
        structuredContent:{authenticated:true,paid_voice_enabled:desktop04Tools!==null}
      };
    }
    if(request.params.name==="verify_shenshu_d1_admission" && typeof admissionDryRun==="function") {
      const result=await admissionDryRun({verifiedSubject});
      return {
        content:[{type:"text",text:"D1 额度与一次性授权门禁已通过 dry-run；未调用 MiniMax。"}],
        structuredContent:result
      };
    }
    if(request.params.name==="probe_oauth_bridge_audio_payload" && privateFixtureEnabled) {
      const fixture=makeInlineToneFixture();
      return {content:[{type:"text",text:"固定非计费 WAV 数据经 OAuth MCP 桥返回，未播放。"}],
        structuredContent:{source:"oauth-bridge-tone",generated:false,
          audioMimeType:fixture.audioMimeType,audioBase64:fixture.audioBase64,
          durationSeconds:fixture.durationSeconds,paid_voice_enabled:false}};
    }
    if(request.params.name===PROPOSED_GENERATED_HOST_TOOL_NAME && privateFixtureEnabled) {
      return makeNonbillableGeneratedHostToolResult();
    }
    if(request.params.name===V1_DESKTOP_04_CAPACITY_NAME && privateFixtureEnabled && desktop04Tools===null) {
      return desktop04CapacityResult();
    }
    if(request.params.name==="probe_oauth_ui_bridge" && privateFixtureEnabled) {
      return {content:[{type:"text",text:"OAuth UI bridge probe OK; no audio or paid tools invoked."}],
        structuredContent:{bridge_verified:true,paid_voice_enabled:false,audio_returned:false},
        _meta:{shenshuWidgetProbe:{version:1,marker:"widget-meta-fixed-nonsecret-v1"}}};
    }
    if(request.params.name==="preview_oauth_hosted_tone_control" && privateFixtureEnabled) {
      return {content:[{type:"text",text:"OAuth 同资源 HTTPS 对照：公开固定提示音，不是私有音频或沈述语音。"}],
        structuredContent:{record:{id:"oauth_hosted_tone_control_001",title:"OAuth HTTPS 对照",
          text:"这是公开固定 HTTPS 测试音频，不是私有语音。",
          audioUrl:"https://shenshu-voice-mcp.onrender.com/test-tone.wav",
          durationSeconds:0.7,voiceLabel:"测试音频",generated:false,source:"hosted-tone"}}};
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
  env,issuer,audience,resourceMetadataUrl,jwksCache=null,proposalBroker=null,
  identityVerifier=null,desktop04Factory=null,voiceCollection=null
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
  // Startup composition may pass the exact verifier already shared with the
  // sealed proposal broker; otherwise the per-request trust path is rebuilt.
  const verifier=typeof identityVerifier==="function"
    ? identityVerifier
    : createStagingIdentityVerifier(env,{issuer,audience,jwksCache});
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
  // Server-side injection only. No request flag or tool argument can enable
  // the bridge; the default staging/production behavior is unchanged.
  let proposalTools=null;
  if(proposalBroker!==null) {
    try {
      proposalTools=createV1P2NonbillableMcpTools({
        broker:proposalBroker,
        verifiedRequest:{headers:{authorization:req.headers.authorization}}
      });
    } catch {
      refuse(503,"proposal_bridge_unavailable");
      return;
    }
  }
  // Do not build this in production unless the trusted server composition
  // explicitly injects the factory AND staging's dedicated flag is on.
  // The normal runtime injects it only after desktop staging configuration,
  // exact deployment identity and sealed D1 schema checks. Default is null.
  let desktop04Tools=null;
  if(desktop04Factory!==null &&
     env.SHENSHU_DESKTOP_04_APP_ENABLED==="1" &&
     env.SHENSHU_PRIVATE_FIXTURE_ENABLED==="1"){
    if(typeof desktop04Factory!=="function"){
      refuse(503,"desktop04_unavailable");return;
    }
    try {
      desktop04Tools=desktop04Factory({
        verifiedRequest:{headers:{authorization:req.headers.authorization}},
        verifiedSubject:verifiedIdentity.subject
      });
    } catch {
      refuse(503,"desktop04_unavailable");return;
    }
  }
  const server=makeStagingMcpServer({verifiedSubject:verifiedIdentity.subject,admissionDryRun,
    privateFixtureEnabled:env.SHENSHU_PRIVATE_FIXTURE_ENABLED==="1",
    proposalTools,desktop04Tools,voiceCollection,
    silverUi:env.SHENSHU_DESKTOP_04_SILVER_UI_ENABLED==="1"});
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
