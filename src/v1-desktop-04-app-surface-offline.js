/**
 * Desktop 04 ChatGPT MCP Apps surface. This dependency-injected module has
 * no live dependencies; only the fully gated staging runtime may mount it.
 *
 * Model can request a NONBILLABLE, authenticated preparation card.
 * Only that card's app calls the app-visible confirmation tool. In the real
 * composition the server MUST supply a durable, atomic one-use owner claim.
 * Visibility is NOT itself authorization; the injected confirm also enforces
 * principal/handle/text-digest binding and rejects replay.
 *
 * No actual MiniMax, Kodo or D1 code is imported or invoked here.
 */
import {createHash} from "node:crypto";
import {checkText} from "./contract.js";

export const DESKTOP_04_PREPARE_TOOL="prepare_shenshu_desktop_04";
export const DESKTOP_04_CONFIRM_TOOL="confirm_shenshu_desktop_04";
export const DESKTOP_04_CAPACITY_TOOL="probe_shenshu_desktop_04_capacity";
export const DESKTOP_04_SPEAK_TOOL="speak_shenshu_desktop_04";
export const DESKTOP_04_CAPACITY_CHARS=2_800_000; // exceeds 2 MiB WAV as base64
const NONSECRET_CAPACITY_PAYLOAD="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".repeat(43_750);
export const DESKTOP_04_UI_RESOURCE="ui://shenshu/desktop-04-bubble-v1.html";

const HANDLE=/^[A-Za-z0-9_-]{43}$/;
const PRINCIPAL=/^[A-Za-z0-9_-]{43}$/;
const BEARER=/^Bearer [A-Za-z0-9_.-]{20,11990}$/;
const SCHEMES=Object.freeze([{type:"oauth2",scopes:["voice:speak"]}]);

function exactKeys(args,keys){
  return !!args && typeof args==="object" && !Array.isArray(args) &&
    Object.keys(args).length===keys.length && keys.every(k=>Object.hasOwn(args,k));
}
function validatePending(record,principal,handle,now){
  if(!record || record.principal!==principal || record.handle!==handle ||
    record.state!=="pending_confirmation" || typeof record.expiresAt!=="string" ||
    !Number.isFinite(Date.parse(record.expiresAt)) ||
    Date.parse(record.expiresAt)<=now) throw new Error("confirmation_unavailable");
  const text=checkText(record.text);
  const digest=createHash("sha256").update(text,"utf8").digest("base64url");
  if(record.textDigest!==digest ||
     record.textBytes!==Buffer.byteLength(text,"utf8")) {
    throw new Error("confirmation_unavailable");
  }
  return text;
}

export function createDesktop04AppSurfaceOffline({
  verifiedRequest,
  resolveVerifiedPrincipal,
  broker,
  loadOwnedPending,
  confirmAndGenerate,
  prepareOnRequest=null,
  clock=Date.now,
}={}){
  const bearer=verifiedRequest?.headers?.authorization;
  if(typeof bearer!=="string" || !BEARER.test(bearer) ||
     typeof resolveVerifiedPrincipal!=="function" ||
     typeof broker?.initiate!=="function" ||
     typeof loadOwnedPending!=="function" ||
     typeof confirmAndGenerate!=="function" ||
     typeof clock!=="function" ||
     (prepareOnRequest!==null&&typeof prepareOnRequest!=="function")) throw new Error("desktop04_surface_unavailable");
  const trustedRequest=Object.freeze({headers:Object.freeze({authorization:bearer})});
  async function principal(){
    const result=await resolveVerifiedPrincipal(trustedRequest);
    const p=result?.principal;
    if(result?.verified!==true||!PRINCIPAL.test(p??""))throw new Error("not_authorized");
    return p;
  }
  const tools=Object.freeze([{
    name:DESKTOP_04_PREPARE_TOOL,
    title:"准备沈述 04 官端语音（不计费）",
    description:prepareOnRequest?"仅准备不计费的手动确认预览。用户明确想听语音时，应使用 speak_shenshu_desktop_04 按既有授权直接生成，不要让用户再次确认。":"为本轮文字准备一张不计费的04语音确认卡。只准备文本和短时提案，不生成声音、不触发费用。",
    inputSchema:{type:"object",properties:{text:{type:"string",minLength:1,maxLength:800}},required:["text"],additionalProperties:false},
    securitySchemes:SCHEMES,
    annotations:{readOnlyHint:false,openWorldHint:false,destructiveHint:false},
    _meta:{securitySchemes:SCHEMES,ui:{resourceUri:DESKTOP_04_UI_RESOURCE,visibility:["model","app"]}},
  },{
    name:DESKTOP_04_CONFIRM_TOOL,
    title:"仅界面使用：确认一次沈述 04 语音生成",
    description:"由官端卡片内用户点击触发，可能产生一次 MiniMax 费用。不可由模型直接选择；服务端再次校验一次性授权。",
    inputSchema:{type:"object",properties:{handle:{type:"string",pattern:"^[A-Za-z0-9_-]{43}$"}},required:["handle"],additionalProperties:false},
    securitySchemes:SCHEMES,
    annotations:{readOnlyHint:false,openWorldHint:false,destructiveHint:true},
    _meta:{securitySchemes:SCHEMES,ui:{visibility:["app"]}},
  },{
    name:DESKTOP_04_CAPACITY_TOOL,
    title:"仅界面使用：检查官端大音频私有传输",
    description:"非计费的约 2.8MB 固定非敏感文本传输测试；没有真正音频或供应商调用。",
    inputSchema:{type:"object",properties:{},additionalProperties:false},
    securitySchemes:SCHEMES,
    annotations:{readOnlyHint:true,openWorldHint:false,destructiveHint:false},
    _meta:{securitySchemes:SCHEMES,ui:{visibility:["app"]}},
  },...(prepareOnRequest?[{
    name:DESKTOP_04_SPEAK_TOOL,
    title:"让沈述用 04 说这句话",
    description:"仅当用户明确要求听语音时使用。用户已授权按请求生成：卡片完成传输检查后自动生成一次收费04语音，不再二次确认。普通聊天禁止调用。每天最多10条。为同一个用户请求保持相同requestKey，工具重试不得换key；文字必须与聊天中这段回复一致，禁止偷偷截断或拆成多次。",
    inputSchema:{type:"object",properties:{text:{type:"string",minLength:1,maxLength:800},requestKey:{type:"string",pattern:"^[A-Za-z0-9_-]{8,128}$"}},required:["text","requestKey"],additionalProperties:false},
    securitySchemes:SCHEMES,
    annotations:{readOnlyHint:false,openWorldHint:false,destructiveHint:true},
    _meta:{securitySchemes:SCHEMES,ui:{resourceUri:DESKTOP_04_UI_RESOURCE,visibility:["model","app"]}},
  }]:[])]);
  return Object.freeze({
    tools,
    async call(name,args){
      if(name===DESKTOP_04_SPEAK_TOOL&&prepareOnRequest){
        if(!exactKeys(args,["text","requestKey"])||typeof args.requestKey!=="string"||!/^[A-Za-z0-9_-]{8,128}$/.test(args.requestKey))throw Error("invalid_arguments");
        const text=checkText(args.text);await principal();
        const proposed=await prepareOnRequest({trustedRequest,text,requestKey:args.requestKey});
        if(proposed?.status==="not_generated"&&["expired","used"].includes(proposed.reason))return {
          content:[{type:"text",text:"这次语音请求已处理或过期，不重复生成。"}],
          structuredContent:{status:"not_generated",reason:proposed.reason,retryable:false}};
        if(proposed?.status!=="pending_confirmation"||!HANDLE.test(proposed.handle??"")||
           !Number.isFinite(Date.parse(proposed.expiresAt))||Date.parse(proposed.expiresAt)<=clock())throw Error("prepare_unavailable");
        return {content:[{type:"text",text:"已接到你的语音请求，卡片准备好后会按已有授权生成一次04语音；请手动播放。"}],
          structuredContent:{desktop04Pending:true,status:"pending_confirmation",autoGenerate:true,dailyLimit:10,
            handle:proposed.handle,expiresAt:proposed.expiresAt,text,billable:false}};
      }
      if(name===DESKTOP_04_PREPARE_TOOL){
        if(!exactKeys(args,["text"]))throw new Error("invalid_arguments");
        const text=checkText(args.text);
        await principal();
        const proposed=await broker.initiate({trustedRequest,text});
        if(proposed?.status!=="pending_confirmation" || proposed.billable!==false ||
           !HANDLE.test(proposed.handle??"") ||
           typeof proposed.expiresAt!=="string" ||
           !Number.isFinite(Date.parse(proposed.expiresAt))||
           Date.parse(proposed.expiresAt)<=clock()) throw new Error("prepare_unavailable");
        return {
          content:[{type:"text",text:"已准备沈述 04 声线的确认卡。本步骤没有调用 MiniMax；用户点击确认才可能产生费用。"}],
          structuredContent:{
            desktop04Pending:true,status:"pending_confirmation",
            handle:proposed.handle,expiresAt:proposed.expiresAt,
            text,billable:false,
          },
        };
      }
      if(name===DESKTOP_04_CAPACITY_TOOL){
        if(!exactKeys(args,[]))throw new Error("invalid_arguments");
        await principal();
        return {
          content:[{type:"text",text:"非计费大音频传输容量检查；仅固定非敏感数据。"}],
          structuredContent:{capacity_probe:true,billable:false,provider_invoked:false},
          _meta:{shenshuCapacityProbe:{
            version:1,marker:"shenshu-capacity-nonsecret-v1",
            length:DESKTOP_04_CAPACITY_CHARS,payload:NONSECRET_CAPACITY_PAYLOAD,
          }},
        };
      }
      if(name===DESKTOP_04_CONFIRM_TOOL){
        if(!exactKeys(args,["handle"])||!HANDLE.test(args.handle))throw new Error("invalid_arguments");
        try {
        const p=await principal();
        const pending=await loadOwnedPending({trustedRequest,principal:p,handle:args.handle});
        const text=validatePending(pending,p,args.handle,clock());
        // Final provider/paid guard lives in the injected atomic grant consumer.
        // Visibility plus a clicked button alone can never confer paid authority.
        const result=await confirmAndGenerate({trustedRequest,handle:args.handle,text});
        if(!result || result.structuredContent?.status!=="audio_ready"||
           !result._meta?.shenshuPrivateAudio?.record ||
           result.structuredContent?.record!==undefined) {
          throw new Error("private_audio_unavailable");
        }
        return result;
        }catch(error){
          const reason={desktop04_daily_limit:"daily_limit",desktop04_expired:"expired",desktop04_used:"used"}[error?.message];
          if(!reason)throw error;
          return {content:[{type:"text",text:"本次未发起新的语音生成；请查看卡片提示。"}],
            structuredContent:{status:"not_generated",reason,retryable:false}};
        }
      }
      throw new Error("unknown_tool");
    }
  });
}
