/** Mount only behind a separately provisioned worker identity verifier.
 * This verifier is NOT the ChatGPT OAuth scope. Never take principal from JSON.
 */
export function createBreezeWorkerHandler({jobs,resolveWorkerPrincipal}={}){
 if(typeof resolveWorkerPrincipal!=='function')throw Error('breeze_worker_auth_required');
 return async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(!path.startsWith('/breeze/worker/'))return false;
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
  function respond(code,value){res.statusCode=code;res.end(JSON.stringify(value));return true;}
  if(req.method!=='POST')return respond(405,{error:'method_not_allowed'});
  let principal;try{principal=await resolveWorkerPrincipal(req);}catch{return respond(401,{error:'unauthorized'});}
  if(!principal)return respond(401,{error:'unauthorized'});
  const limit=2800000;let n=0;const chunks=[];
  try{for await(const b of req){n+=b.length;if(n>limit)return respond(413,{error:'too_large'});chunks.push(b);}
   const args=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(!args||Array.isArray(args)||typeof args!=='object')return respond(400,{error:'invalid_request'});
   const fields=Object.keys(args??{}).sort().join(',');let result;
   if(path==='/breeze/worker/claim'&&fields==='')result=await jobs.claim(principal);
   else if(path==='/breeze/worker/complete'&&fields==='audioBase64,claimToken,id')result=await jobs.complete(principal,args);
   else if(path==='/breeze/worker/fail'&&fields==='claimToken,id'){await jobs.fail(principal,args);result={failed:true};}
   else return respond(400,{error:'invalid_request'});
   return respond(200,result);
  }catch{return respond(400,{error:'breeze_worker_request_failed'});}
 };
}
