import { db } from "hatchable";
export const access="user";
export const methods=["GET"];
export default async function(req,res){
 const uid=req.user.id;
 const recent=await db.query("SELECT provider,status,count(*)::int runs,round(avg(latency_ms))::int avg_latency_ms FROM ai_runs WHERE user_id=$1 AND created_at>=now()-interval '7 days' GROUP BY provider,status ORDER BY provider,status",[uid]);
 const fallbacks=await db.query("SELECT count(*)::int count FROM ai_runs WHERE user_id=$1 AND created_at>=now()-interval '7 days' AND fallback_used=true",[uid]);
 res.json({window_days:7,providers:recent.rows,fallbacks:fallbacks.rows[0]?.count||0});
}