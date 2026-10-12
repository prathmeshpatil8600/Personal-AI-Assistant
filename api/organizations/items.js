import { db } from "hatchable";
import { requireOrgRole,orgError } from "../../lib/organizations.js";
export const access="user";
export const methods=["GET"];
export default async function(req,res){
 const orgId=String(req.query?.organization_id||"").trim();
 if(!orgId)return res.status(400).json({error:"organization_id is required"});
 const gate=await requireOrgRole(req.user.id,orgId,"MEMBER");if(!gate.ok)return orgError(res,gate);
 const rows=(await db.query("SELECT id,item_type,title,content,status,created_by,updated_by,created_at,updated_at FROM organization_shared_items WHERE organization_id=$1 ORDER BY updated_at DESC LIMIT 250",[orgId])).rows;
 res.json(rows);
}