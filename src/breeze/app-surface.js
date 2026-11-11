/** Explicit local-voice tools, built only when a trusted runtime injects a queue.
 * Default off. No paid factory and no implicit MiniMax fallback.
 */
import {requireCanonicalPrincipal} from '../canonical-principal.js';
import {readFileSync} from 'node:fs';
import {buildDesktopSilverUi} from '../desktop-silver-ui.js';
export const BREEZE_RESOURCE='ui://shenshu/breeze-silver-v1.html';
export function createBreezeTools({principal,jobs,collection}={}){
 requireCanonicalPrincipal(principal);
 const securitySchemes=[{type:'oauth2',scopes:['voice:speak']}];
 const tools=[{name:'speak_shenshu_local_breeze',title:'听沈述的本地声音',description:'仅当本人明确要求听本地 Breeze 语音时使用。电脑必须在线；不调用 MiniMax，不消耗付费语音额度。同一请求重试保持同一个 requestKey。',inputSchema:{type:'object',properties:{requestKey:{type:'string'},text:{type:'string'}},required:['requestKey','text'],additionalProperties:false}},
 {name:'poll_shenshu_local_breeze',title:'读取本地语音任务',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false}}]
 .map((t,i)=>({...t,securitySchemes,annotations:{readOnlyHint:i===1,destructiveHint:false,openWorldHint:false},_meta:{securitySchemes,ui:{resourceUri:BREEZE_RESOURCE,visibility:i===0?['model','app']:['app']}}}));
 return {tools,async call(name,args){
  if(!args||Array.isArray(args)||typeof args!=='object')throw Error('invalid_arguments');
  if(name==='speak_shenshu_local_breeze'){
   if(Object.keys(args).sort().join(',')!=='requestKey,text')throw Error('invalid_arguments');
   if(!await jobs.available(principal))return {content:[{type:'text',text:'本地电脑暂时不可用，请先启动 Breeze 和桥接器；没有调用 MiniMax。'}],structuredContent:{breezeUnavailable:true}};
   const job=await jobs.enqueue(principal,args);return {content:[{type:'text',text:'本地声音任务已提交；电脑在线时生成，不调用 MiniMax。'}],structuredContent:{breezePending:true,id:job.id,state:job.state}};
  }
  if(name!=='poll_shenshu_local_breeze'||Object.keys(args).join(',')!=='id')throw Error('invalid_arguments');
  const result=await jobs.poll(principal,args.id);
  const base={content:[{type:'text',text:result.state==='ready'?'本地语音已准备好，请点击播放。':'本地声音任务状态已更新。'}],structuredContent:{breezePending:true,id:result.id,state:result.state}};
  if(result.state==='ready'){
   base._meta={shenshuPrivateAudio:{record:result.record}};
   try{if(collection)base._meta.shenshuCollection={receipt:collection.issueReceipt(principal,result.record),saved:false};}catch{}
  }
  return base;
 }};
}
/** New independent resource specializes the existing player for truthful Breeze
 * provenance. Existing MiniMax/public resources remain byte-for-byte unchanged.
 */
export function buildBreezeSilverUi({collectionEnabled=false}={}){
 let html=readFileSync(new URL('../../ui/mcp-bubble.html',import.meta.url),'utf8');
 html=buildDesktopSilverUi(html,{collectionEnabled,allowBreeze:true});
 const addon=readFileSync(new URL('../../ui/breeze-pending.js',import.meta.url),'utf8');
 html=html.replace('if(msg.method==="ui/notifications/tool-result"){','if(msg.method==="ui/notifications/tool-result"){\n    if(msg.params?.structuredContent?.breezePending){void breezePending(msg.params);return;}');
 html=html.replace('</script>',addon+'\n</script>');return html;
}
