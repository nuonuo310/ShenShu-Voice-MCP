/** Explicit operator CLI. Read-only D1 preflight; no server route, no writes. */
import {runManualD1ReadOnlyPreflight} from "./d1-qualification-manual-readonly.js";
const allowed=process.argv.length===2&&process.env.SHENSHU_D1_READONLY_PREFLIGHT==="1";
if(!allowed){console.error("preflight_disabled");process.exitCode=2;}
else {
 try {
  const result=await runManualD1ReadOnlyPreflight();
  console.log(JSON.stringify({preflight:result.preflight,readOnly:true,writeAuthorized:false,paidVoiceEnabled:false}));
 } catch {console.error("preflight_failed");process.exitCode=1;}
}
