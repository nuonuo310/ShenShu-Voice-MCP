/** Manual, local-only, read-only D1 preflight. No HTTP server route, no writes. */
import {buildD1QualificationPlan} from "./d1-qualification-plan-only.js";
import {createQualificationReadOnlyD1Http} from "./d1-qualification-readonly-http.js";
import {inspectD1QualificationReadOnly} from "./d1-qualification-readonly-preflight.js";
export async function runManualD1ReadOnlyPreflight({env=process.env,fetchImpl=fetch}={}){
 if(env?.SHENSHU_D1_READONLY_PREFLIGHT!=="1")throw Error("preflight_disabled");
 const plan=buildD1QualificationPlan({testPrincipal:"dryrun_qualification_p2x_20261020_a",day:"2026-10-20",runId:"p2x20261020a",attempts:12,limit:3});
 const client=createQualificationReadOnlyD1Http({env,fetchImpl});
 return inspectD1QualificationReadOnly({plan,client});
}
