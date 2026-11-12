/** Explicitly launched local audition. Never starts or reloads the Breeze model. */
import {createServer} from 'node:http';
import {resolve,join} from 'node:path';
import {homedir} from 'node:os';
import {createBreezeAuditionHandler} from '../../src/breeze/audition-server.js';
import {synthesizeLocalBreeze,localBreezeEndpoint} from '../../src/breeze/local-adapter.js';
const endpoint=process.env.SHENSHU_BREEZE_LOCAL_ORIGIN||'http://127.0.0.1:8080';localBreezeEndpoint(endpoint);
const directory=resolve(process.env.SHENSHU_BREEZE_AUDITION_DIR||join(process.env.LOCALAPPDATA||homedir(),'ShenShu','BreezeAuditions'));
const port=Number(process.env.SHENSHU_BREEZE_AUDITION_PORT||8082);
if(!Number.isSafeInteger(port)||port<1024||port>65535)throw Error('invalid_audition_port');
const handler=await createBreezeAuditionHandler({directory,synthesize:args=>synthesizeLocalBreeze({...args,endpoint}),log:value=>console.log(JSON.stringify(value))});
const server=createServer((req,res)=>{void handler(req,res);});
server.headersTimeout=15000;server.requestTimeout=15000;server.timeout=0;
server.on('error',()=>{console.error('Local audition could not start. Check the local port.');process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log('Local audition: http://127.0.0.1:'+port+'/'));
