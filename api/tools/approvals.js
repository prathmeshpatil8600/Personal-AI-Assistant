import { db } from "hatchable";
export const access="member";
export const methods=["GET","POST"];
export default async function(req,res){
 const uid=req.member.id;
 if(req.method==="GET"){
  const r=await db.query("SELECT id,conversation_id,tool_name,risk_level,input_json,status,expires_at,decided_at,created_at FROM tool_approvals WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",[uid]);
  return res.json(r.rows);
 }
 const id=String(req.body?.id||"").trim(),decision=String(req.body?.decision||"").toUpperCase();
 if(!id||!["APPROVED","REJECTED"].includes(decision))return res.status(400).json({error:"id and decision APPROVED/REJECTED are required."});
 const r=await db.query("UPDATE tool_approvals SET status=$1,decided_at=now() WHERE id=$2 AND user_id=$3 AND status='PENDING' AND expires_at>now() RETURNING id,tool_name,risk_level,status,decided_at",[decision,id,uid]);
 if(!r.rows.length)return res.status(404).json({error:"Pending approval not found or expired."});
 res.json(r.rows[0]);
}