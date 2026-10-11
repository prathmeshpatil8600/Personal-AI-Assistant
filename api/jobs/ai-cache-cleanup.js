import { db } from "hatchable";
export const access="scheduler";
export const methods=["POST"];
export default async function(req,res){
 const expired=(await db.query("DELETE FROM ai_response_cache WHERE expires_at<=now() RETURNING id")).rowCount||0;
 const oldMetrics=(await db.query("DELETE FROM ai_optimization_daily WHERE metric_date<CURRENT_DATE-365 RETURNING user_id")).rowCount||0;
 res.json({expired_cache_entries:expired,old_metric_rows:oldMetrics,cleaned_at:new Date().toISOString()});
}