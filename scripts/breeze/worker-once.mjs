/** One outbound attempt only. No autorun, secret logging, or local inbound port. */
import {runBreezeWorkerOnce} from '../../src/breeze/worker.js';
import {synthesizeLocalBreeze} from '../../src/breeze/local-adapter.js';
const origin=new URL(process.env.SHENSHU_BREEZE_QUEUE_ORIGIN??'');
const token=process.env.SHENSHU_BREEZE_WORKER_TOKEN;
const stateDirectory=process.env.SHENSHU_BREEZE_WORKER_STATE;
if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||!token||!stateDirectory)throw Error('breeze_worker_configuration_required');
async function rpc(action,args){
 const r=await fetch(new URL('/breeze/worker/'+action,origin),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args),redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('breeze_queue_unavailable');return r.json();
}
try{do{
 const result=await runBreezeWorkerOnce({stateDirectory,queue:{claim:()=>rpc('claim',{}),complete:r=>rpc('complete',r),fail:r=>rpc('fail',r)},synthesize:args=>synthesizeLocalBreeze({...args,endpoint:process.env.SHENSHU_BREEZE_LOCAL_ORIGIN})});
 console.log(JSON.stringify({state:result.state}));
 if(process.argv.includes('--loop'))await new Promise(resolve=>setTimeout(resolve,3000));
 }while(process.argv.includes('--loop'));
}catch{console.error('Breeze worker stopped; no automatic retry or paid fallback.');process.exitCode=1;}
