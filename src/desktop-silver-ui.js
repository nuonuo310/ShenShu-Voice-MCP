import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../ui/desktop-silver.css',import.meta.url),'utf8');
const addon=readFileSync(new URL('../ui/desktop-collection.js',import.meta.url),'utf8');
const avatar=readFileSync(new URL('../ui/assets/shen-avatar.jpeg',import.meta.url)).toString('base64');
/** Specializes only the desktop resource; leaves public mock and diagnostics source alone. */
export function buildDesktopSilverUi(html,{collectionEnabled=false}={}){
 const start=html.indexOf('  <div class="bubble"');
 const end=html.indexOf('  <p class="text"',start);
 if(start<0||end<0)throw Error('silver_ui_template_missing');
 const markup=`  <div class="bubble silver-player" role="group" aria-label="沈述的语音">
    <div class="kiss" id="kiss" aria-hidden="true"><span>♥</span> Mwah</div>
    <div class="portrait" aria-hidden="true"><img src="data:image/jpeg;base64,${avatar}" alt=""><small>S · N</small></div>
    <div class="silver-screen"><div class="screen-heading"><strong>沈述</strong><small>for Nuonuo</small></div>
      <div class="wave" id="wave" aria-hidden="true"></div>
      <div class="timeline"><div class="track" role="progressbar" aria-label="语音播放进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="silver-track"><i id="silver-progress"></i></div><span class="duration" id="duration">0:00</span></div>
    </div>
    <div class="silver-controls"><button id="play" type="button" aria-label="播放语音" disabled><span class="glyph"></span></button>
      <button class="favorite" id="favorite" type="button" aria-label="收藏这段语音" aria-pressed="false" disabled><svg viewBox="0 0 32 32" aria-hidden="true"><path d="m16 3 4 8.3 9.2 1.3-6.6 6.5 1.6 9.1-8.2-4.3-8.2 4.3 1.6-9.1-6.6-6.5 9.2-1.3Z"/></svg></button>
    </div>
  </div>
  <div class="collection-toolbar"><button id="gallery-open" type="button" ${collectionEnabled?'':'disabled'}>沈述声音馆</button><span id="favorite-status" role="status" aria-live="polite"></span></div>
  <section id="voice-gallery" hidden aria-labelledby="gallery-title"><header><h2 id="gallery-title">沈述声音馆</h2><button id="gallery-close" type="button" aria-label="收起声音馆">收起</button></header><p class="gallery-note">本人私有收藏 · 播放不会重新生成</p><div id="gallery-list"></div><button id="gallery-more" type="button" hidden>查看更多</button><p id="gallery-status" role="status" aria-live="polite"></p></section>
`;
 html=html.slice(0,start)+markup+html.slice(end);
 html=html.replace('</style>',css+'\n</style>');
 html=html.replace('applyResponse({structuredContent:{record:next}});','applyResponse({structuredContent:{record:next}});\n    try{desktopCollection.receive(next,response?._meta?.shenshuCollection);}catch{}');
 html=html.replace('  if(bridgePlaying||!audio.paused)frame=', '  try{desktopCollection.paint(p,bridgePlaying||!audio.paused,d,bridgePlayback?bridgeElapsed:audio.currentTime);}catch{}\n  if(bridgePlaying||!audio.paused)frame=');
 html=html.replace('  if(msg.method==="ui/notifications/tool-result"){',`  if(msg.method==="ui/notifications/tool-result"){
    if(msg.params?.structuredContent?.collectionView){desktopCollection.showPage(msg.params?._meta?.shenshuCollectionPage);return;}`);
 html=html.replace('</script>',`\n${addon.replace('__COLLECTION_ENABLED__',JSON.stringify(collectionEnabled))}\n</script>`);
 return html;
}
