import { db } from "hatchable";
import { requireOrgRole,orgError } from "../../lib/organizations.js";
export const access="user";
export const methods=["GET"];
export default async function(req,res){
 const orgId=String(req.query?.organization_id||"").trim();if(!orgId)return res.status(400).json({error:"organization_id is required"});
 const gate=await requireOrgRole(req.user.id,orgId,"ADMIN");if(!gate.ok)return orgError(res,gate);
 const rows=(await db.query("SELECT id,'u_'||substr(md5(actor_user_id),1,10) AS actor_ref,action,target_type,target_id,metadata,created_at FROM organization_audit_log WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 200",[orgId])).rows;
 res.json(rows);
}