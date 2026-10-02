import { db } from "hatchable";
export const access="member";
export const methods=["GET"];
export default async function(req,res){
 const r=await db.query("SELECT id,conversation_id,tool_name,provider,risk_level,status,approval_required,approval_id,error_message,latency_ms,started_at,completed_at FROM tool_runs WHERE user_id=$1 ORDER BY started_at DESC LIMIT 100",[req.member.id]);
 res.json(r.rows);
}