// Polling only reads an existing task; it never submits another synthesis.
let breezeActiveId=null,breezePollEpoch=0;
async function breezePending(result){
 const job=result?.structuredContent;if(!/^voice_[a-f0-9]{32}$/.test(job?.id??''))return;
 if(breezeActiveId===job.id)return;breezeActiveId=job.id;const epoch=++breezePollEpoch;
 const deadline=Date.now()+20*60*1000;
 try{
  // Reopening the same completed request supplies its ID, not another audio
  // payload. Read the original result once; never enqueue or synthesize again.
  if(job.state==='ready'&&!result?._meta?.shenshuPrivateAudio?.record){
   result=await request('tools/call',{name:'poll_shenshu_local_breeze',arguments:{id:job.id}});
   if(result?.isError||result?.structuredContent?.id!==job.id)throw Error();
  }
  while(epoch===breezePollEpoch&&Date.now()<deadline){
   const state=result?.structuredContent?.state;
   if(state==='ready'){
    const next=result?._meta?.shenshuPrivateAudio?.record;
    validateGeneratedBridgeRecord(next);applyResponse({structuredContent:{record:next}});
    desktopCollection.receive(next,result?._meta?.shenshuCollection);
    $('status').textContent='本地声音已准备好，点击播放。';return;
   }
   if(['failed','unknown','expired'].includes(state)){$('status').textContent='本地生成未完成；没有切换到 MiniMax，也不会自动重新生成。';return;}
   $('status').textContent=state==='claimed'?'电脑正在生成本地声音，请稍等…':'正在等待本地电脑领取任务…';
   await new Promise(resolve=>setTimeout(resolve,2000));
   result=await request('tools/call',{name:'poll_shenshu_local_breeze',arguments:{id:job.id}});
   if(result?.isError||result?.structuredContent?.id!==job.id)throw Error();
  }
  if(epoch===breezePollEpoch)$('status').textContent='等待已停止，可稍后读取原任务；不会自动重新生成。';
 }catch{$('status').textContent='暂时无法读取本地声音任务；没有重新生成或调用 MiniMax。';}
 finally{if(epoch===breezePollEpoch)breezeActiveId=null;}
}
