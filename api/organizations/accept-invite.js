import { db } from "hatchable";
import { hashToken,writeOrgAudit } from "../../lib/organizations.js";
export const access="member";
export const methods=["POST"];
export default async function(req,res){
 const token=String(req.body?.invite_token||"").trim();
 if(token.length<32)return res.status(400).json({error:"Valid invite token is required."});
 const hash=await hashToken(token);
 try{
  const accepted=(await db.query("SELECT * FROM accept_organization_invite_atomic($1,$2)",[hash,req.member.id])).rows[0];
  await writeOrgAudit({orgId:accepted.organization_id,actor:req.member.id,action:"INVITE_ACCEPTED",targetType:"membership",targetId:req.member.id,metadata:{role:accepted.member_role}});
  res.json({ok:true,organization:{id:accepted.organization_id,name:accepted.organization_name},role:accepted.member_role});
 }catch(e){
  const msg=String(e?.message||e);
  if(msg.includes("invite_invalid"))return res.status(404).json({error:"invite_invalid",message:"Invite is invalid, expired, or already used."});
  if(msg.includes("already_member"))return res.status(409).json({error:"already_member"});
  if(msg.includes("organization_seat_limit_reached"))return res.status(429).json({error:"seat_limit",message:"This organization has no available seats."});
  if(msg.includes("organization_unavailable"))return res.status(409).json({error:"organization_unavailable"});
  throw e;
 }
}