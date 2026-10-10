import { db } from "hatchable";
export const access="member";
export const methods=["POST"];
export default async function(req,res){
 const id=String(req.body?.id||"").trim();if(!id)return res.status(400).json({error:"id is required"});
 const row=(await db.query("UPDATE developer_api_keys SET status='REVOKED',revoked_at=now() WHERE id=$1 AND user_id=$2 AND organization_id IS NULL AND status='ACTIVE' RETURNING id,status,revoked_at",[id,req.member.id])).rows[0];
 if(!row)return res.status(404).json({error:"Active API key not found."});
 res.json(row);
}