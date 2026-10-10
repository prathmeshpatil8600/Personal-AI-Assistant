import { db } from "hatchable";
import { writeOrgAudit } from "../../lib/organizations.js";
export const access="admin";
export const methods=["POST"];
export default async function(req,res){
 const orgId=String(req.body?.organization_id||"").trim();
 const seatLimit=Number.parseInt(req.body?.seat_limit,10);
 const tier=String(req.body?.business_tier||"BUSINESS_TRIAL").toUpperCase();
 const billing=String(req.body?.billing_status||"TRIAL").toUpperCase();
 if(!orgId||!Number.isSafeInteger(seatLimit)||seatLimit<1||seatLimit>10000||!["BUSINESS_TRIAL","BUSINESS_CUSTOM"].includes(tier)||!["TRIAL","ACTIVE","PAST_DUE","PAUSED","CANCELLED"].includes(billing))return res.status(400).json({error:"Valid organization_id, seat_limit, business_tier and billing_status are required."});
 const active=Number((await db.query("SELECT count(*)::int AS n FROM organization_memberships WHERE organization_id=$1 AND status='ACTIVE'",[orgId])).rows[0]?.n||0);
 if(seatLimit<active)return res.status(409).json({error:"seat_limit_below_active_members",active_members:active});
 const row=(await db.query("UPDATE organizations SET seat_limit=$1,business_tier=$2,billing_status=$3,updated_at=now() WHERE id=$4 RETURNING id,name,seat_limit,business_tier,billing_status,trial_ends_at",[seatLimit,tier,billing,orgId])).rows[0];
 if(!row)return res.status(404).json({error:"Organization not found."});
 await db.query("UPDATE organization_billing_accounts SET seat_quantity=$1,status=$2,updated_at=now() WHERE organization_id=$3",[seatLimit,billing==="TRIAL"?"TRIAL":billing,orgId]);
 await writeOrgAudit({orgId,actor:req.member.id,action:"BUSINESS_PLAN_UPDATED",targetType:"organization",targetId:orgId,metadata:{seat_limit:seatLimit,business_tier:tier,billing_status:billing}});
 res.json(row);
}