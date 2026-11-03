/**
 * Dormant desktop 04 ChatGPT MCP Apps tool pair (no actual paid tool mounted).
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
export const DESKTOP_04_UI_RESOURCE="ui://shenshu/private-fixture-bubble-v2.html";

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
  clock=Date.now,
}={}){
  const bearer=verifiedRequest?.headers?.authorization;
  if(typeof bearer!=="string" || !BEARER.test(bearer) ||
     typeof resolveVerifiedPrincipal!=="function" ||
     typeof broker?.initiate!=="function" ||
     typeof loadOwnedPending!=="function" ||
     typeof confirmAndGenerate!=="function" ||
     typeof clock!=="function") throw new Error("desktop04_surface_unavailable");
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
    description:"为本轮文字准备一张不计费的04语音确认卡。只准备文本和短时提案，不生成声音、不触发费用。",
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
  }]);
  return Object.freeze({
    tools,
    async call(name,args){
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
      if(name===DESKTOP_04_CONFIRM_TOOL){
        if(!exactKeys(args,["handle"])||!HANDLE.test(args.handle))throw new Error("invalid_arguments");
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
      }
      throw new Error("unknown_tool");
    }
  });
}
