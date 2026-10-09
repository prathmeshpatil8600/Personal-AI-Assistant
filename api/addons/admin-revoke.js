import { db } from "hatchable";
export const access="admin";
export const methods=["POST"];
export default async function(req,res){
 const grantId=String(req.body?.grant_id||"").trim();
 if(!grantId)return res.status(400).json({error:"grant_id is required"});
 const row=(await db.query("UPDATE addon_grants SET revoked_at=now() WHERE id=$1 AND revoked_at IS NULL RETURNING id,user_id,addon_code,revoked_at",[grantId])).rows[0];
 if(!row)return res.status(404).json({error:"Active grant not found."});
 res.json({ok:true,grant:row});
}