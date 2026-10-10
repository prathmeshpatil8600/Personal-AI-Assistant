import { db } from "hatchable";
import { requireOrgRole,orgError,writeOrgAudit } from "../../lib/organizations.js";
export const access="member";
export const methods=["POST"];
export default async function(req,res){
 const orgId=String(req.body?.organization_id||"").trim(),target=String(req.body?.user_id||"").trim(),role=String(req.body?.role||"").toUpperCase();
 if(!orgId||!target||!["ADMIN","MEMBER","BILLING"].includes(role))return res.status(400).json({error:"Valid organization_id, user_id and role are required."});
 const gate=await requireOrgRole(req.member.id,orgId,"OWNER");if(!gate.ok)return orgError(res,gate);
 if(target===req.member.id)return res.status(409).json({error:"owner_role_locked",message:"Transfer of ownership is not supported yet."});
 const row=(await db.query("UPDATE organization_memberships SET role=$1,updated_at=now() WHERE organization_id=$2 AND user_id=$3 AND status='ACTIVE' AND role<>'OWNER' RETURNING user_id,role,status,updated_at",[role,orgId,target])).rows[0];
 if(!row)return res.status(404).json({error:"Member not found."});
 await writeOrgAudit({orgId,actor:req.member.id,action:"MEMBER_ROLE_CHANGED",targetType:"membership",targetId:target,metadata:{role}});
 res.json(row);
}