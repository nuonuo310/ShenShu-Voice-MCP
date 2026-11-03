/** Fixed nonsecret capacity probe, no audio, no billing, no credentials. */
export const V1_DESKTOP_04_CAPACITY_NAME="probe_shenshu_desktop_04_capacity";
export const V1_DESKTOP_04_CAPACITY_LENGTH=2_800_000;
const PATTERN="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+";
const oauth=Object.freeze([{type:"oauth2",scopes:["voice:speak"]}]);

export function desktop04CapacityDescriptor(){
  return {
    name:V1_DESKTOP_04_CAPACITY_NAME,
    title:"检查官端私有数据传输容量（非计费）",
    description:"仅向 ChatGPT 私有界面发送固定非敏感数据，不调用 MiniMax，不产生音频。",
    inputSchema:{type:"object",properties:{},additionalProperties:false},
    securitySchemes:oauth,
    annotations:{readOnlyHint:true,openWorldHint:false,destructiveHint:false},
    _meta:{securitySchemes:oauth,ui:{visibility:["app"]}},
  };
}
export function desktop04CapacityResult(){
  return {
    content:[{type:"text",text:"非计费 UI 通道容量测试；没有生成语音。"}],
    structuredContent:{capacity_probe:true,billable:false,provider_invoked:false},
    _meta:{shenshuCapacityProbe:{
      version:1,marker:"shenshu-capacity-nonsecret-v1",
      length:V1_DESKTOP_04_CAPACITY_LENGTH,
      payload:PATTERN.repeat(43_750),
    }},
  };
}
