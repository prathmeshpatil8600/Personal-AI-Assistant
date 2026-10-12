import { db } from "hatchable";
import { requireOrgRole,orgError,writeOrgAudit } from "../../lib/organizations.js";
export const access="user";
export const methods=["POST"];
export default async function(req,res){
 const orgId=String(req.body?.organization_id||"").trim(),slug=String(req.body?.integration_slug||"").trim();
 const gate=await requireOrgRole(req.user.id,orgId,"ADMIN");if(!gate.ok)return orgError(res,gate);
 const row=(await db.query("UPDATE integration_installations SET status='REMOVED',updated_at=now() WHERE organization_id=$1 AND integration_slug=$2 AND status<>'REMOVED' RETURNING integration_slug,status,updated_at",[orgId,slug])).rows[0];
 if(!row)return res.status(404).json({error:"installation_not_found"});
 await writeOrgAudit({orgId,actor:req.user.id,action:"INTEGRATION_REMOVED",targetType:"integration",targetId:slug});
 res.json(row);
}