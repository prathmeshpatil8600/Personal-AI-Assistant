import { db } from "hatchable";
import { requireOrgRole,orgError,writeOrgAudit } from "../../lib/organizations.js";
export const access="member";
export const methods=["POST"];
export default async function(req,res){
 const orgId=String(req.body?.organization_id||"").trim(),inviteId=String(req.body?.invite_id||"").trim();
 if(!orgId||!inviteId)return res.status(400).json({error:"organization_id and invite_id are required."});
 const gate=await requireOrgRole(req.member.id,orgId,"ADMIN");if(!gate.ok)return orgError(res,gate);
 const row=(await db.query("UPDATE organization_invites SET revoked_at=now() WHERE id=$1 AND organization_id=$2 AND accepted_at IS NULL AND revoked_at IS NULL RETURNING id,revoked_at",[inviteId,orgId])).rows[0];
 if(!row)return res.status(404).json({error:"Active invite not found."});
 await writeOrgAudit({orgId,actor:req.member.id,action:"INVITE_REVOKED",targetType:"invite",targetId:inviteId});
 res.json(row);
}