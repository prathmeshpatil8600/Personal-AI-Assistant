import { db } from "hatchable";
import { requireOrgWrite,orgError,randomToken,hashToken,activeSeatCount,writeOrgAudit } from "../../lib/organizations.js";
export const access="user";
export const methods=["POST"];
export default async function(req,res){
 const orgId=String(req.body?.organization_id||"").trim();
 const role=String(req.body?.role||"MEMBER").toUpperCase();
 const emailHint=String(req.body?.email_hint||"").trim().slice(0,180)||null;
 if(!orgId||!["ADMIN","MEMBER","BILLING"].includes(role))return res.status(400).json({error:"Valid organization_id and role are required."});
 const gate=await requireOrgWrite(req.user.id,orgId,"ADMIN");if(!gate.ok)return orgError(res,gate);
 const seats=await activeSeatCount(orgId);
 const outstanding=Number((await db.query("SELECT count(*)::int AS n FROM organization_invites WHERE organization_id=$1 AND revoked_at IS NULL AND accepted_at IS NULL AND expires_at>now()",[orgId])).rows[0]?.n||0);
 if(seats+outstanding>=Number(gate.membership.seat_limit))return res.status(429).json({error:"seat_limit",message:"No seats are available for another invite."});
 const token=randomToken(),hash=await hashToken(token);
 const invite=(await db.query(`
  INSERT INTO organization_invites(organization_id,token_hash,email_hint,role,created_by)
  VALUES($1,$2,$3,$4,$5)
  RETURNING id,organization_id,email_hint,role,expires_at,created_at
 `,[orgId,hash,emailHint,role,req.user.id])).rows[0];
 await writeOrgAudit({orgId,actor:req.user.id,action:"INVITE_CREATED",targetType:"invite",targetId:invite.id,metadata:{role,email_hint:emailHint}});
 res.status(201).json({...invite,invite_token:token});
}