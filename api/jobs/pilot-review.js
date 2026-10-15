import { savePilotReview } from "../../lib/pilot-review.js";
import { runTrackedJob } from "../../lib/ops.js";
export const access="scheduler";
export const methods=["POST"];
export default async function(req,res){
 const result=await runTrackedJob("pilot_review",async()=>savePilotReview({cohort:"PILOT_1",checkpoint:"DAILY"}));
 res.json(result);
}