/** P2X offline HTTP media route contract, deliberately not mounted in server.js. */
import {prepareAuthorizedAudioHttpResponse} from "./private-https-audio-response.js";

/** Must receive a server-owned identity verifier. Never accept identity from query args. */
export async function handleOfflineAuthorizedMedia(req,res,{authorize,loadAudio}={}) {
  const reject=(status,code)=>{
    res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});
    res.end(JSON.stringify({error:code}));
  };
  if(req.method!=="GET"){reject(405,"method_not_allowed");return;}
  if(typeof req.headers?.authorization!=="string"||!req.headers.authorization.startsWith("Bearer ")){
    reject(401,"unauthorized");return;
  }
  try {
    const result=await prepareAuthorizedAudioHttpResponse({trustedRequest:req,authorize,loadAudio});
    res.writeHead(result.status,result.headers);
    res.end(result.body);
  } catch(error) {
    reject(error?.message==="not_authorized"?401:503,"audio_unavailable");
  }
}
