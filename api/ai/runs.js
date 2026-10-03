import { db } from "hatchable";
export const access="member";
export const methods=["GET"];
export default async function(req,res){
 const r=await db.query("SELECT id,purpose,requested_model,provider,model,status,fallback_used,input_tokens,output_tokens,total_tokens,latency_ms,error_code,error_message,created_at,completed_at FROM ai_runs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",[req.member.id]);
 res.json(r.rows);
}