import { db } from "hatchable";
import { requireOrgRole,orgError,writeOrgAudit } from "../../lib/organizations.js";
export const access="user";
export const methods=["POST"];
export default async function(req,res){
 const orgId=String(req.body?.organization_id||"").trim(),target=String(req.body?.user_id||"").trim();
 if(!orgId||!target)return res.status(400).json({error:"organization_id and user_id are required."});
 const gate=await requireOrgRole(req.user.id,orgId,"ADMIN");if(!gate.ok)return orgError(res,gate);
 const targetRow=(await db.query("SELECT role,status FROM organization_memberships WHERE organization_id=$1 AND user_id=$2",[orgId,target])).rows[0];
 if(!targetRow||targetRow.status!=="ACTIVE")return res.status(404).json({error:"Member not found."});
 if(targetRow.role==="OWNER")return res.status(409).json({error:"owner_cannot_be_removed"});
 if(gate.membership.role==="ADMIN"&&targetRow.role==="ADMIN")return res.status(403).json({error:"admin_cannot_remove_admin"});
 const row=(await db.query("UPDATE organization_memberships SET status='REMOVED',updated_at=now() WHERE organization_id=$1 AND user_id=$2 RETURNING user_id,role,status",[orgId,target])).rows[0];
 await writeOrgAudit({orgId,actor:req.user.id,action:"MEMBER_REMOVED",targetType:"membership",targetId:target,metadata:{role:targetRow.role}});
 res.json(row);
}