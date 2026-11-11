// Runs inside the specialized desktop module, reusing existing request/applyResponse.
// No provider, public URL, localStorage, or independent audio player.
const desktopCollection=(()=>{
 const enabled=__COLLECTION_ENABLED__;
 let current=null,receipt=null,saved=false,busy=false,cursor=null,wasPlaying=false,kissed=false;
 const favorite=$('favorite'),gallery=$('voice-gallery'),list=$('gallery-list'),feedback=$('favorite-status');
 function sync(){favorite.disabled=!enabled||!current||!receipt||busy;favorite.setAttribute('aria-pressed',String(saved));favorite.setAttribute('aria-label',saved?'取消收藏这段语音':'收藏这段语音');}
 function receive(next,meta){current=next;receipt=meta?.receipt??null;saved=meta?.saved===true;kissed=false;sync();feedback.textContent=enabled&&!receipt?'这段语音没有收藏凭据，仍可正常播放。':'';paint();}
 async function rpc(name,args){const r=await request('tools/call',{name,arguments:args});if(r?.isError||r?.structuredContent?.collectionError)throw Error('collection_failed');return r;}
 function addRows(page,append=false){
  if(!page||!Array.isArray(page.records))throw Error('collection_failed');
  if(!append)list.replaceChildren();
  for(const m of page.records){
   const row=document.createElement('article');row.className='gallery-row';row.dataset.id=m.id;
   const copy=document.createElement('p');copy.textContent=m.body;
   const date=document.createElement('small');date.textContent=new Date(m.createdAt).toLocaleString()+' · '+fmt(m.duration);
   const actions=document.createElement('div');actions.className='gallery-actions';
   const listen=document.createElement('button');listen.type='button';listen.textContent='载入播放';
   listen.onclick=async()=>{listen.disabled=true;try{const r=await rpc('get_shenshu_voice_favorite',{id:m.id});const next=r?._meta?.shenshuPrivateAudio?.record;if(!next)throw Error();validateGeneratedBridgeRecord(next);applyResponse({structuredContent:{record:next}});receive(next,r._meta.shenshuCollection);$('gallery-status').textContent='已载入，点击上方播放。';}catch{$('gallery-status').textContent='未能载入收藏，当前音频保持可用。';}finally{listen.disabled=false;}};
   const remove=document.createElement('button');remove.type='button';remove.textContent='取消收藏';
   remove.onclick=async()=>{remove.disabled=true;try{await rpc('remove_shenshu_voice_favorite',{id:m.id});row.remove();if(current?.id===m.id){saved=false;sync();}$('gallery-status').textContent='已取消收藏。';}catch{$('gallery-status').textContent='取消收藏未完成，请稍后再试。';}finally{remove.disabled=false;}};
   actions.append(listen,remove);row.append(copy,date,actions);list.append(row);
   if(current?.id===m.id){saved=true;sync();}
  }
  cursor=page.cursor??null;$('gallery-more').hidden=!cursor;
  $('gallery-status').textContent=list.children.length?'':'还没有收藏，喜欢的那句可以点星星留下。';
 }
 async function load(append=false){$('gallery-status').textContent='正在读取收藏…';$('gallery-more').disabled=true;try{const r=await rpc('list_shenshu_voice_favorites',{cursor:append?cursor:null});addRows(r?._meta?.shenshuCollectionPage,append);}catch{$('gallery-status').textContent='暂时读不到收藏，当前语音仍可播放。';}finally{$('gallery-more').disabled=false;}}
 favorite.addEventListener('click',async()=>{
  if(favorite.disabled)return;const item=current,proof=receipt,removing=saved;busy=true;sync();feedback.textContent=removing?'正在取消收藏…':'正在收藏…';
  try{const r=await rpc(removing?'remove_shenshu_voice_favorite':'save_shenshu_voice_favorite',removing?{id:item.id}:{record:item,receipt:proof});if(!removing&&r?.structuredContent?.saved!==true)throw Error();if(current===item)saved=!removing;feedback.textContent=removing?'已取消收藏':'已收藏';if(!gallery.hidden)void load();}
  catch{feedback.textContent='收藏操作未完成，语音仍可播放；不会重新生成。';}finally{busy=false;sync();}
 });
 $('gallery-open').addEventListener('click',()=>{if(!enabled)return;gallery.hidden=false;void load();});
 $('gallery-close').addEventListener('click',()=>{gallery.hidden=true;});
 $('gallery-more').addEventListener('click',()=>{if(cursor)void load(true);});
 sync();
 return {receive,showPage(page){gallery.hidden=false;if(!current)$('status').textContent='选择一段收藏后，可在上方播放。';try{addRows(page);}catch{$('gallery-status').textContent='暂时读不到收藏。';}},
  paint(p,playing,d,elapsed){
   $('silver-progress').style.width=(p*100)+'%';$('silver-track').setAttribute('aria-valuenow',String(Math.round(p*100)));
   $('duration').textContent=fmt(elapsed)+' / '+fmt(d);
   document.querySelector('.silver-player').classList.toggle('is-playing',playing);
   if(playing&&!wasPlaying&&!kissed){kissed=true;$('kiss').classList.remove('show');void $('kiss').offsetWidth;$('kiss').classList.add('show');}
   if(!playing&&(p>=.999||audioOutputDiagnostic.ended===true))kissed=false;
   wasPlaying=playing;
  }};
})();
