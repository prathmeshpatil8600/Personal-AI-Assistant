import { savePilotDecision } from "../../lib/pilot-decision.js";
import { runTrackedJob } from "../../lib/ops.js";
export const access="scheduler";
export const methods=["POST"];
export default async function(req,res){
 const result=await runTrackedJob("pilot_decision_snapshot",async()=>savePilotDecision("PILOT_1"));
 res.json(result);
}