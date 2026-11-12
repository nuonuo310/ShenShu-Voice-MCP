/* Manual local page only. No auto-generation or retries, no external assets. */
const $=id=>document.getElementById(id),audio=$('audio');
let active=null,blobUrl=null,generating=false,heard=false;
const rules={daily:'日常：seed 7 · cfg 1.2，保持原来的自然说话方式。',kiss:'亲吻：seed 7 · cfg 2.0。先建立亲吻动作，在句中放一次 [亲吻]，之后继续说话；爱爱不要放开头。',breath:'轻喘：seed 7 · cfg 2.0。在自然停顿中放一次 [喘息]，前后都要有台词，不在结尾追加；爱爱不要放开头。'};
function showRules(){const kiss=$('preset').value==='kiss';$('kiss-cue-row').hidden=!kiss;$('cue-note').hidden=!kiss;$('rules').textContent=kiss&&$('kiss-cue').value==='mwah'?'亲吻：seed 7 · cfg 2.0。在句中只写一次 mwah，不加 [亲吻]；先建立亲吻动作，之后继续说话。':rules[$('preset').value];}
$('kiss-cue').addEventListener('change',showRules);
$('preset').addEventListener('change',showRules);showRules();
for(const h of [8,13,21,29,17,12,23,16,31,19,12,21,15,9,18,7]){const bar=document.createElement('i');bar.style.setProperty('--h',h+'px');$('wave').append(bar);}
function state(text){$('status').textContent=text;}
function lock(value){generating=value;document.querySelectorAll('#generate,#preset,#kiss-cue,#input,#candidates button').forEach(el=>{el.disabled=value;});}
async function rpc(path,body){
 const response=await fetch(path,{method:body?'POST':'GET',headers:{'x-breeze-audition-token':auditionToken,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const value=await response.json();if(!response.ok)throw Error(value.error||value.status||'request_failed');return value;
}
const fmt=seconds=>Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0');
async function load(record){
 audio.pause();active=null;heard=false;$('play').disabled=true;$('review').hidden=true;
 if(blobUrl){URL.revokeObjectURL(blobUrl);blobUrl=null;}
 const response=await fetch('/api/audio/'+record.id,{headers:{'x-breeze-audition-token':auditionToken}});
 if(!response.ok)throw Error('audio_load_failed');blobUrl=URL.createObjectURL(await response.blob());audio.src=blobUrl;audio.load();active=record;
 $('current-text').textContent=record.text;$('duration').textContent=fmt(record.duration);$('play').disabled=false;$('review').hidden=false;
 document.querySelectorAll('[data-axis]').forEach(el=>{el.checked=record.review?.checks?.[el.dataset.axis]===true;});$('notes').value=record.review?.notes||'';
 state('已载入，点击小猫气泡播放。');
}
function paint(){const playing=!audio.paused&&!audio.ended;$('play').classList.toggle('playing',playing);$('play').setAttribute('aria-label',playing?'暂停语音':'播放语音');const fraction=audio.duration?audio.currentTime/audio.duration:0;document.querySelectorAll('#wave i').forEach((el,i)=>el.classList.toggle('heard',i/16<fraction));}
for(const event of ['play','pause','ended','timeupdate'])audio.addEventListener(event,paint);
audio.addEventListener('ended',()=>{heard=true;state('播放结束，可填写这条候选的听感。');});
$('play').onclick=async()=>{try{if(audio.paused)await audio.play();else audio.pause();}catch{state('播放未成功，请再点一次，或刷新记录重新载入。');}};
async function history(){
 const {records}=await rpc('/api/history');$('history').replaceChildren();
 for(const record of records){const row=document.createElement('div');row.className='record';const label=document.createElement('p');label.textContent=record.presetId+(record.presetId==='kiss'?' / '+(record.kissCue??'tag'):'')+' · '+record.status+' · '+record.createdAt+(record.review?' · '+record.review.verdict:' · 待人工确认');row.append(label);
  if(record.status==='ready'){const button=document.createElement('button');button.textContent='载入播放';button.onclick=()=>load(record).catch(()=>state('音频载入失败，原记录保留。'));row.append(button);}
  const detail=document.createElement('details'),summary=document.createElement('summary'),content=document.createElement('p');summary.textContent='文字与参数';content.textContent=record.text+'\n'+JSON.stringify(record.parameters);detail.append(summary,content);row.append(detail);$('history').append(row);
 }
}
async function generate(){
 if(generating)return;lock(true);state('本机正在生成，请稍等；不会自动重试。');
 const id=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
 try{const record=await rpc('/api/generate',{id,presetId:$('preset').value,text:$('input').value,...($('preset').value==='kiss'?{kissCue:$('kiss-cue').value}:{})});if(record.status==='ready')await load(record);else state('任务状态：'+record.status+'。请从记录查看，不会重复生成。');}
 catch(error){state('未完成：'+error.message+'。先刷新记录检查状态，不会自动重新生成。');}
 finally{lock(false);await history().catch(()=>{});}
}
$('generate').onclick=generate;
for(const candidate of auditionCandidates){const row=document.createElement('div');row.className='candidate';const text=document.createElement('p');text.textContent=candidate.id+'：'+candidate.text;const button=document.createElement('button');button.textContent='填入这条（不生成）';button.onclick=()=>{$('preset').value=candidate.presetId;$('kiss-cue').value='tag';$('input').value=candidate.text;showRules();state('已填入，请点“生成这一条”。');};row.append(text,button);$('candidates').append(row);}
async function review(verdict){if(!active)return;if(!heard){state('请先完整听完这一条，再提交评价。');return;}const checks={};document.querySelectorAll('[data-axis]').forEach(el=>checks[el.dataset.axis]=el.checked);try{await rpc('/api/review',{id:active.id,checks,verdict,notes:$('notes').value});state('已保存这条候选的人工评价；没有将预设标为稳定支持。');await history();}catch{state('评价未保存；认可时请确认五项都通过。');}}
$('accept').onclick=()=>review('accepted');$('reject').onclick=()=>review('rejected');$('refresh').onclick=()=>history().catch(()=>state('记录读取失败。'));
history().catch(()=>state('记录读取失败。'));
