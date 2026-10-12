import { db } from "hatchable";
import { requireOrgRole,orgError } from "../../lib/organizations.js";
export const access="user";
export const methods=["GET"];
export default async function(req,res){
 const orgId=String(req.query?.organization_id||"").trim();if(!orgId)return res.status(400).json({error:"organization_id is required"});
 const gate=await requireOrgRole(req.user.id,orgId,"ADMIN");if(!gate.ok)return orgError(res,gate);
 const rows=(await db.query("SELECT id,email_hint,role,created_by,expires_at,accepted_by,accepted_at,revoked_at,created_at FROM organization_invites WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100",[orgId])).rows;
 res.json(rows);
}