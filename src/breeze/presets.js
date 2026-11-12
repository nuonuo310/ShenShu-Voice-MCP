/** Owner-approved audition candidates only. Human stability review is pending.
 * Event presets are available exclusively to the manual loopback audition UI.
 */
import {checkText} from '../contract.js';
const dailyInstruction='自然、清晰、有温度的日常对话。语气放松亲近，使用平常说话的节奏，不要朗诵。';
const make=(id,label,cfg,instruction,rules)=>Object.freeze({id,label,voice_id:'shenshu_04_natural',seed:'7',cfg_scale:cfg,instruction,rules:Object.freeze(rules),reviewStatus:id==='daily'?'daily-baseline':'human-review-pending'});
export const BREEZE_PRESETS=Object.freeze({
 daily:make('daily','日常','1.2',dailyInstruction,[]),
 kiss:make('kiss','亲吻 · 待复测','2.0',dailyInstruction+'亲吻是说话人此刻亲近对方的自然动作。[亲吻]处轻轻亲一下，动作融入前后对话，之后自然接着说话。保持原本声线；不要读标签，不要旁白、播报或表演配音。',['one-kiss','embedded-action','no-breath']),
 breath:make('breath','轻喘 · 待复测','2.0',dailyInstruction+'[喘息]处是一声自然、轻微的换气，嵌在说话的自然停顿里，接着清楚地说完后半句。保持原本声线和正常音量，不要刻意夸张或连续喘息，不要读标签，不要在句尾另加声音。',['one-breath','embedded-pause','no-kiss'])
});
export function resolveBreezePreset(presetId='daily'){
 if(typeof presetId!=='string'||!Object.hasOwn(BREEZE_PRESETS,presetId))throw Error('breeze_unknown_preset');
 return BREEZE_PRESETS[presetId];
}
export function prepareBreezeSpeech({text,presetId}={}){
 checkText(text);const preset=resolveBreezePreset(presetId);
 if(preset.id!=='daily'){
  const tag=preset.id==='kiss'?'[亲吻]':'[喘息]',other=preset.id==='kiss'?'[喘息]':'[亲吻]';
  if(text.split(tag).length!==2||text.includes(other))throw Error('breeze_event_tag_required');
  const [before,after]=text.split(tag),spoken=s=>/[\p{L}\p{N}]/u.test(s);
  if(!spoken(before)||!spoken(after))throw Error('breeze_event_must_be_embedded');
  if(/[\[\]［］]/u.test(before+after))throw Error('breeze_unsupported_event_tag');
  if(/^\s*爱爱/u.test(text))throw Error('breeze_name_after_context');
  if(preset.id==='kiss'&&(!/(亲|吻)/u.test(before)||/(旁白|音效|配音|播放亲吻)/u.test(text)))throw Error('breeze_kiss_action_required');
 }
 const {voice_id,seed,cfg_scale,instruction}=preset;
 return {preset,fields:{voice_id,seed,cfg_scale,instruction,text}};
}
