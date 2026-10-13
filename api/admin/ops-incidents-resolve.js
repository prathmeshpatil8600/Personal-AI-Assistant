import { db } from "hatchable";
export const access="admin";
export const methods=["POST"];
export default async function(req,res){
 const id=String(req.body?.id||"").trim();
 if(!id)return res.status(400).json({error:"id is required"});
 const row=(await db.query("UPDATE operational_incidents SET resolved_at=now() WHERE id=$1 AND resolved_at IS NULL RETURNING id,resolved_at",[id])).rows[0];
 if(!row)return res.status(404).json({error:"incident_not_found"});
 res.json({ok:true,incident:row});
}