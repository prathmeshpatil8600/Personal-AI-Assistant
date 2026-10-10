import { db } from "hatchable";
import { requireOrgRole,orgError,writeOrgAudit } from "../../lib/organizations.js";
export const access="member";
export const methods=["POST"];
export default async function(req,res){
 const orgId=String(req.body?.organization_id||"").trim(),name=String(req.body?.name||"").trim();
 if(!orgId||name.length<2||name.length>120)return res.status(400).json({error:"Valid organization_id and name are required."});
 const gate=await requireOrgRole(req.member.id,orgId,"ADMIN");if(!gate.ok)return orgError(res,gate);
 const row=(await db.query("UPDATE organizations SET name=$1,updated_at=now() WHERE id=$2 RETURNING id,name,slug,status,seat_limit,business_tier,billing_status,trial_ends_at",[name,orgId])).rows[0];
 await db.query("UPDATE organization_workspaces SET name=$1,updated_at=now() WHERE organization_id=$2",[name+" workspace",orgId]);
 await writeOrgAudit({orgId,actor:req.member.id,action:"ORG_UPDATED",targetType:"organization",targetId:orgId,metadata:{name}});
 res.json(row);
}