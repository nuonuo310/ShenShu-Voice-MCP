/** Private favorites, independent from generation/admission and provider transport.
 * Gallery field mapping follows ShenShu-Voice/packages/voice-data. Audio is not a URL.
 * D1 publishes a manifest only after every encrypted part has been staged.
 */
import {createCipheriv,createDecipheriv,createHash,createHmac,hkdfSync,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {checkText,validateWav,MAX_WAV_BYTES} from './contract.js';
import {requireCanonicalPrincipal} from './canonical-principal.js';
export const COLLECTION_RESOURCE='ui://shenshu/desktop-04-bubble-v1.html';
const ID=/^voice_[a-f0-9]{32}$/;
const ISO=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
function identity(p,id){requireCanonicalPrincipal(p);if(id!==undefined&&!ID.test(id))throw Error('collection_invalid');}
function keys(masterKey){
 if(!Buffer.isBuffer(masterKey)||masterKey.length!==32)throw Error('collection_unavailable');
 return Object.fromEntries(['encryption','receipt'].map(p=>[p,Buffer.from(hkdfSync('sha256',masterKey,'shenshu-private-favorites-v1',p,32))]));
}
function codec(key){return {
 seal(value,aad){const nonce=randomBytes(12),c=createCipheriv('aes-256-gcm',key,nonce);c.setAAD(Buffer.from(aad));
 const data=Buffer.concat([c.update(value),c.final()]);return Buffer.concat([nonce,c.getAuthTag(),data]).toString('base64');},
 open(value,aad){const b=Buffer.from(value,'base64');if(b.length<28)throw Error('collection_invalid');
 const c=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));c.setAAD(Buffer.from(aad));c.setAuthTag(b.subarray(12,28));return Buffer.concat([c.update(b.subarray(28)),c.final()]);}
};}
function clean(record){
 if(!record||!ID.test(record.id??''))throw Error('collection_invalid');
 const text=checkText(record.text);
 if(record.source!=='minimax'||record.generated!==true||record.desktopDirect04!==true||record.audioMimeType!=='audio/wav'||
 typeof record.audioBase64!=='string'||record.audioBase64.length>Math.ceil(MAX_WAV_BYTES/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(record.audioBase64))throw Error('collection_invalid');
 const audio=Buffer.from(record.audioBase64,'base64');const meta=validateWav(audio);
 if(audio.toString('base64')!==record.audioBase64||!Number.isFinite(record.durationSeconds)||Math.abs(meta.durationSeconds-record.durationSeconds)>.001)throw Error('collection_invalid');
 return {id:record.id,text,audioBase64:record.audioBase64,durationSeconds:meta.durationSeconds};
}
const digest=r=>createHash('sha256').update(JSON.stringify(r)).digest('base64url');
export function createPrivateVoiceCollection({client,masterKey,clock=Date.now}={}){
 if(typeof client?.query!=='function'||typeof clock!=='function')throw Error('collection_unavailable');
 const k=keys(masterKey),crypt=codec(k.encryption);
 const stamp=()=>new Date(clock()).toISOString();
 const aad=(p,id,part)=>JSON.stringify(['favorites-v1',p,id,part]);
 function sign(p,r,createdAt){return createHmac('sha256',k.receipt).update(JSON.stringify([p,r.id,createdAt,digest(r)])).digest('base64url');}
 function metadata(row,p){identity(p,row.id);const m=JSON.parse(crypt.open(row.sealed_metadata,aad(p,row.id,'metadata')).toString('utf8'));
  if(m.id!==row.id||!ISO(m.createdAt)||m.createdAt!==row.created_at||checkText(m.body)!==m.body)throw Error('collection_invalid');return m;}
 return Object.freeze({
  async verifySchema(){for(const t of ['voice_favorites','voice_favorite_parts'])await client.query(`SELECT * FROM ${t} LIMIT 0`);return true;},
  issueReceipt(principal,record){identity(principal);const r=clean(record),createdAt=ISO(record.createdAt)?record.createdAt:stamp();return {createdAt,signature:sign(principal,r,createdAt)};},
  async save(principal,record,receipt){
   identity(principal);const r=clean(record);
   if(!ISO(receipt?.createdAt)||typeof receipt?.signature!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(receipt.signature))throw Error('collection_invalid');
   const expected=sign(principal,r,receipt.createdAt);
   if(!timingSafeEqual(Buffer.from(expected),Buffer.from(receipt.signature)))throw Error('collection_invalid');
   const old=await client.query('SELECT * FROM voice_favorites WHERE principal=? AND id=?',[principal,r.id]);
   if(old[0])return metadata(old[0],principal); // idempotent, including process restart
   // Compatible metadata: id/title/date/duration/body/captions/demo from existing gallery.
   const m={id:r.id,title:'沈述 · 语音留言',date:receipt.createdAt.slice(0,10),createdAt:receipt.createdAt,
    duration:r.durationSeconds,body:r.text,captions:[],demo:false};
   const encrypted=crypt.seal(Buffer.from(r.audioBase64,'base64'),aad(principal,r.id,'audio'));
   const chunks=encrypted.match(/.{1,64000}/g),upload=randomUUID(),staged=stamp();
   try{
    for(let i=0;i<chunks.length;i++)await client.query('INSERT INTO voice_favorite_parts(principal,id,upload_id,part,payload,staged_at) VALUES(?,?,?,?,?,?)',[principal,r.id,upload,i,chunks[i],staged]);
    await client.query('INSERT INTO voice_favorites(principal,id,created_at,upload_id,part_count,sealed_metadata) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM voice_favorite_parts WHERE principal=? AND id=? AND upload_id=?)=? ON CONFLICT(principal,id) DO NOTHING',
     [principal,r.id,m.createdAt,upload,chunks.length,crypt.seal(Buffer.from(JSON.stringify(m)),aad(principal,r.id,'metadata')),principal,r.id,upload,chunks.length]);
    const rows=await client.query('SELECT * FROM voice_favorites WHERE principal=? AND id=?',[principal,r.id]);
    if(!rows[0])throw Error('collection_unavailable');
    if(rows[0].upload_id!==upload)await client.query('DELETE FROM voice_favorite_parts WHERE principal=? AND id=? AND upload_id=?',[principal,r.id,upload]);
    return metadata(rows[0],principal);
   }catch{
    // Ambiguous commit: never remove a possibly published upload. Orphans can be
    // swept offline after a day, only when NOT referenced by any manifest.
    throw Error('collection_unavailable');
   }
  },
  async list(principal,cursor=null){
   identity(principal);if(cursor!==null&&(!ISO(cursor.createdAt)||!ID.test(cursor.id??'')))throw Error('collection_invalid');
   const rows=cursor?await client.query('SELECT * FROM voice_favorites WHERE principal=? AND (created_at<? OR (created_at=? AND id<?)) ORDER BY created_at DESC,id DESC LIMIT 11',[principal,cursor.createdAt,cursor.createdAt,cursor.id]):
    await client.query('SELECT * FROM voice_favorites WHERE principal=? ORDER BY created_at DESC,id DESC LIMIT 11',[principal]);
   const page=rows.slice(0,10),last=page.at(-1);
   return {records:page.map(r=>metadata(r,principal)),cursor:rows.length>10?{createdAt:last.created_at,id:last.id}:null};
  },
  async get(principal,id){
   identity(principal,id);const rows=await client.query('SELECT * FROM voice_favorites WHERE principal=? AND id=?',[principal,id]);
   if(!rows[0])throw Error('collection_not_found');const row=rows[0],m=metadata(row,principal),parts=[];
   if(!Number.isSafeInteger(row.part_count)||row.part_count<1||row.part_count>64)throw Error('collection_invalid');
   for(let i=0;i<row.part_count;i+=3){
    // Three 64k parts stay comfortably below the existing D1 HTTP response cap.
    const batch=await client.query('SELECT part,payload FROM voice_favorite_parts WHERE principal=? AND id=? AND upload_id=? AND part>=? AND part<? ORDER BY part',[principal,id,row.upload_id,i,Math.min(i+3,row.part_count)]);
    if(batch.length!==Math.min(3,row.part_count-i))throw Error('collection_invalid');
    for(let j=0;j<batch.length;j++){const part=batch[j];if(part.part!==i+j||typeof part.payload!=='string'||part.payload.length>64000)throw Error('collection_invalid');parts.push(part.payload);}
   }
   const audio=crypt.open(parts.join(''),aad(principal,id,'audio'));const wav=validateWav(audio);
   if(Math.abs(wav.durationSeconds-m.duration)>.001)throw Error('collection_invalid');
   return {id,title:m.title,text:m.body,durationSeconds:m.duration,createdAt:m.createdAt,voiceLabel:'沈述',generated:true,source:'minimax',desktopDirect04:true,audioMimeType:'audio/wav',audioBase64:audio.toString('base64')};
  },
  async remove(principal,id){identity(principal,id);await client.query('DELETE FROM voice_favorites WHERE principal=? AND id=?',[principal,id]);return {removed:true,id};},
 });
}
const SCHEMES=[{type:'oauth2',scopes:['voice:speak']}];
export function createCollectionTools({collection,principal}={}){
 identity(principal);
 const schemas={
  open_shenshu_voice_gallery:{},
  save_shenshu_voice_favorite:{record:{type:'object'},receipt:{type:'object'}},
  list_shenshu_voice_favorites:{cursor:{type:['object','null']}},
  get_shenshu_voice_favorite:{id:{type:'string',pattern:ID.source}},
  remove_shenshu_voice_favorite:{id:{type:'string',pattern:ID.source}},
 };
 const tools=Object.entries(schemas).map(([name,properties])=>({name,title:name==='open_shenshu_voice_gallery'?'沈述声音馆':name,
  description:name==='open_shenshu_voice_gallery'?'打开本人私有的已收藏语音列表。不合成、不扣语音额度。':'仅界面使用：本人私有语音收藏操作，不生成语音。',
  inputSchema:{type:'object',properties,required:Object.keys(properties),additionalProperties:false},securitySchemes:SCHEMES,
  annotations:{readOnlyHint:!/^save|^remove/.test(name),destructiveHint:name.startsWith('remove'),openWorldHint:false},
  _meta:{securitySchemes:SCHEMES,ui:{resourceUri:COLLECTION_RESOURCE,visibility:name==='open_shenshu_voice_gallery'?['model','app']:['app']}}}));
 return {tools,async call(name,args={}){
  if(!Object.hasOwn(schemas,name)||!args||Array.isArray(args)||typeof args!=='object'||Object.keys(args).length!==Object.keys(schemas[name]).length||Object.keys(schemas[name]).some(k=>!Object.hasOwn(args,k)))throw Error('invalid_arguments');
  try{
   if(name==='save_shenshu_voice_favorite'){const record=await collection.save(principal,args.record,args.receipt);return {content:[{type:'text',text:'已收藏。'}],structuredContent:{saved:true,id:record.id}};}
   if(name==='remove_shenshu_voice_favorite')return {content:[{type:'text',text:'已取消收藏。'}],structuredContent:await collection.remove(principal,args.id)};
   if(name==='get_shenshu_voice_favorite'){const record=await collection.get(principal,args.id);return {content:[{type:'text',text:'已读取本人收藏，请点击播放。'}],structuredContent:{status:'audio_ready'},_meta:{shenshuPrivateAudio:{record},shenshuCollection:{saved:true,receipt:collection.issueReceipt(principal,record)}}};}
   const page=await collection.list(principal,name==='list_shenshu_voice_favorites'?args.cursor:null);
   return {content:[{type:'text',text:'沈述声音馆：本人私有收藏。'}],structuredContent:{collectionView:true},_meta:{shenshuCollectionPage:page}};
  }catch{return {isError:true,content:[{type:'text',text:'收藏操作未完成，当前语音仍可播放。'}],structuredContent:{collectionError:true}};}
 }};
}
