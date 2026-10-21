/** Pure offline once-only admission contract. No D1 connection, no writes. */
const RUN="p2x20261020a";
export async function claimQualificationOnce({runId,gate}={}){
 if(runId!==RUN||!gate||typeof gate.claimOnce!=="function")throw Error("once_gate_invalid");
 const result=await gate.claimOnce(RUN);
 if(result?.claimed===true&&result?.runId===RUN)return Object.freeze({claimed:true,runId:RUN});
 if(result?.claimed===false)return Object.freeze({claimed:false,reason:"already_claimed"});
 throw Error("once_gate_ambiguous_stop");
}
