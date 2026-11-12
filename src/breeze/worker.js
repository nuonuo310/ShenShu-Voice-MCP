/** Outbound queue interface: claim(), complete(result), fail(identity).
 * A durably created local marker is written BEFORE synthesis. On restart an
 * ambiguous attempt stops instead of synthesizing the same job a second time.
 */
import {open,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {synthesizeLocalBreeze} from './local-adapter.js';
export async function runBreezeWorkerOnce({queue,stateDirectory,synthesize=synthesizeLocalBreeze}={}){
 if(!stateDirectory||!queue?.claim||!queue?.complete||!queue?.fail)throw Error('breeze_worker_unconfigured');
 const job=await queue.claim();if(!job)return {state:'idle'};
 if(!/^voice_[a-f0-9]{32}$/.test(job.id??'')||!/^[-A-Za-z0-9_]{43}$/.test(job.claimToken??''))throw Error('breeze_invalid_job');
 await mkdir(stateDirectory,{recursive:true,mode:0o700});
 let marker;
 try{marker=await open(join(stateDirectory,job.id+'.attempt'),'wx',0o600);await marker.writeFile('attempted\n');await marker.sync();}catch{if(marker)await marker.close();throw Error('breeze_attempt_unknown');}
 await marker.close();
 let audio;
 try{audio=await synthesize({text:job.text});}catch{await queue.fail({id:job.id,claimToken:job.claimToken});return {id:job.id,state:'failed'};}
 // Upload failure intentionally propagates. Never call synthesize again to
 // repair a network failure; claim expires to unknown in the durable queue.
 await queue.complete({id:job.id,claimToken:job.claimToken,audioBase64:audio.toString('base64')});
 return {id:job.id,state:'ready'};
}
