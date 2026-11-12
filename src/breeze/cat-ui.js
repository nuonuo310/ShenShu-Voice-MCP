import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../../ui/breeze-cat.css',import.meta.url),'utf8');
const cat=readFileSync(new URL('../../ui/assets/breeze-cat.svg',import.meta.url),'utf8');
/** Breeze-only presentation. Keep existing audio, owner RPC and collection hooks. */
export function buildBreezeCatUi(html){
 const start=html.indexOf('  <div class="bubble silver-player"');
 const end=html.indexOf('  <section id="voice-gallery"',start);
 if(start<0||end<0)throw Error('breeze_cat_template_missing');
 const star='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m16 3 4 8.3 9.2 1.3-6.6 6.5 1.6 9.1-8.2-4.3-8.2 4.3 1.6-9.1-6.6-6.5 9.2-1.3Z"/></svg>';
 const markup=`  <div class="bubble silver-player breeze-cat-player" role="group" aria-label="沈述的本地语音">
    <div class="cat-companion" aria-hidden="true">${cat}</div>
    <svg class="cat-paws" viewBox="0 0 64 40" aria-hidden="true"><g fill="currentColor"><g transform="rotate(-18 17 14)"><ellipse cx="17" cy="18" rx="8" ry="6"/><ellipse cx="7" cy="11" rx="3" ry="4"/><ellipse cx="14" cy="6" rx="3" ry="4"/><ellipse cx="22" cy="7" rx="3" ry="4"/><ellipse cx="28" cy="13" rx="3" ry="4"/></g><g transform="translate(31 14) scale(.85)"><ellipse cx="17" cy="18" rx="8" ry="6"/><ellipse cx="7" cy="11" rx="3" ry="4"/><ellipse cx="14" cy="6" rx="3" ry="4"/><ellipse cx="22" cy="7" rx="3" ry="4"/><ellipse cx="28" cy="13" rx="3" ry="4"/></g></g></svg>
    <button id="play" type="button" aria-label="播放语音" disabled><span class="glyph"></span></button>
    <div class="wave" id="wave" aria-hidden="true"></div>
    <span class="duration" id="duration">0:00</span>
    <svg class="cat-yarn" viewBox="0 0 120 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2 33q26 10 37-3q8-15-2-14q-14 3 4 18q18 13 45-1"/><circle cx="99" cy="24" r="17" fill="#e3edf2"/><path d="m87 12 24 22m-29-13 22 20m-7-34 18 20m-28 8 21-24m-24 14 14-18m-6 32 23-22m-8-7q-10 16-3 29M83 20q13 3 24 16"/></g></svg>
    <div class="breeze-progress" hidden><div id="silver-track" role="progressbar" aria-label="语音播放进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="silver-progress"></i></div></div>
    <span id="kiss" hidden></span>
  </div>
  <div class="collection-toolbar cat-toolbar"><button id="gallery-open" type="button">沈述声音馆</button><span id="favorite-status" role="status" aria-live="polite"></span><button class="favorite" id="favorite" type="button" aria-label="收藏这段语音" aria-pressed="false" disabled>${star}</button></div>
`;
 // Preserve enabled/disabled gallery state from the trusted collection builder.
 const enabled=!html.slice(start,end).includes('id="gallery-open" type="button" disabled');
 html=html.slice(0,start)+markup.replace('id="gallery-open" type="button"','id="gallery-open" type="button"'+(enabled?'':' disabled'))+html.slice(end);
 html=html.replace('<body>','<body class="breeze-cat">').replace('</style>',css+'\n</style>');
 html=html.replace(/const heights=\[[^\]]+\];/,'const heights=[8,13,21,29,17,12,23,16,31,19,12,21,15,9,18,7];');
 // Keep elapsed/progress updates, show only total time in the compact face.
 html=html.replace("$('duration').textContent=fmt(elapsed)+' / '+fmt(d);","$('duration').textContent=fmt(d);\n   $('play').setAttribute('aria-label',playing?'暂停语音':'播放语音');");
 return html;
}
