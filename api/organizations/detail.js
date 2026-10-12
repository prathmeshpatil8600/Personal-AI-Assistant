import { db } from "hatchable";
import { requireOrgRole,orgError } from "../../lib/organizations.js";
export const access="user";
export const methods=["GET"];
export default async function(req,res){
 const id=String(req.query?.id||"").trim();if(!id)return res.status(400).json({error:"id is required"});
 const gate=await requireOrgRole(req.user.id,id,"MEMBER");if(!gate.ok)return orgError(res,gate);
 const org=(await db.query("SELECT id,name,slug,status,seat_limit,business_tier,entitlements,billing_status,trial_ends_at,created_at,updated_at FROM organizations WHERE id=$1",[id])).rows[0];
 const members=(await db.query("SELECT user_id,role,status,joined_at,updated_at FROM organization_memberships WHERE organization_id=$1 ORDER BY CASE role WHEN 'OWNER' THEN 1 WHEN 'ADMIN' THEN 2 WHEN 'BILLING' THEN 3 ELSE 4 END,joined_at",[id])).rows;
 const workspace=(await db.query("SELECT id,name,created_at,updated_at FROM organization_workspaces WHERE organization_id=$1",[id])).rows[0]||null;
 res.json({organization:org,membership:{role:gate.membership.role},members,workspace});
}