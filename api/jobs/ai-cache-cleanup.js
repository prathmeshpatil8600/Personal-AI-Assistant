import { db } from "hatchable";
import { runTrackedJob } from "../../lib/ops.js";
export const access="scheduler";
export const methods=["POST"];
export default async function(req,res){
 const result=await runTrackedJob("ai_cache_cleanup",async()=>{
  const expired=(await db.query("DELETE FROM ai_response_cache WHERE expires_at<=now() RETURNING id")).rowCount||0;
  const oldMetrics=(await db.query("DELETE FROM ai_optimization_daily WHERE metric_date<CURRENT_DATE-365 RETURNING user_id")).rowCount||0;
  return {expired_cache_entries:expired,old_metric_rows:oldMetrics,cleaned_at:new Date().toISOString()};
 });
 res.json(result);
}