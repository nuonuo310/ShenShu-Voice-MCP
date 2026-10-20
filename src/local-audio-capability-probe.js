/** P2X standalone nonsecret browser media capability probe; not wired to MCP. */
export async function probeLocalAudioCapabilities({AudioCtor,BlobCtor,URLApi,fixtureBytes}) {
  if(typeof AudioCtor!=="function"||typeof BlobCtor!=="function"||!URLApi||
     typeof URLApi.createObjectURL!=="function"||typeof URLApi.revokeObjectURL!=="function"||
     !(fixtureBytes instanceof Uint8Array)||fixtureBytes.length<44)throw Error("invalid_probe_dependencies");
  const audio=new AudioCtor();
  const canPlayWav=typeof audio.canPlayType==="function"?audio.canPlayType("audio/wav"):"";
  let blobUrl=null;
  try {
    blobUrl=URLApi.createObjectURL(new BlobCtor([fixtureBytes],{type:"audio/wav"}));
    if(typeof blobUrl!=="string"||!blobUrl.startsWith("blob:"))throw Error("invalid_blob_url");
    return Object.freeze({wavCapability:canPlayWav,blobUrlCreated:true,playbackTested:false});
  } finally {if(blobUrl)URLApi.revokeObjectURL(blobUrl)}
}
