import { savePilotMeasurement } from "../../lib/pilot-measurement.js";
import { runTrackedJob } from "../../lib/ops.js";
export const access="scheduler";
export const methods=["POST"];
export default async function(req,res){
 const result=await runTrackedJob("pilot_measurement_snapshot",async()=>savePilotMeasurement("PILOT_1"));
 res.json(result);
}