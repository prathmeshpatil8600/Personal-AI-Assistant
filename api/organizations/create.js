import { db } from "hatchable";
import { slugifyOrgName,writeOrgAudit } from "../../lib/organizations.js";
export const access="member";
export const methods=["POST"];
export default async function(req,res){
 const name=String(req.body?.name||"").trim();
 if(name.length<2||name.length>120)return res.status(400).json({error:"Organization name must be 2–120 characters."});
 const existing=(await db.query("SELECT count(*)::int AS n FROM organization_memberships WHERE user_id=$1 AND status='ACTIVE' AND role='OWNER'",[req.member.id])).rows[0]?.n||0;
 if(Number(existing)>=5)return res.status(429).json({error:"organization_limit",message:"This account has reached the organization ownership limit."});
 const base=slugifyOrgName(name);let slug=base;
 for(let i=0;i<6;i++){
  const taken=(await db.query("SELECT 1 FROM organizations WHERE slug=$1 LIMIT 1",[slug])).rows[0];
  if(!taken)break;slug=base+"-"+crypto.randomUUID().replaceAll("-","").slice(0,6);
 }
 const org=(await db.query(`
  INSERT INTO organizations(name,slug,owner_user_id)
  VALUES($1,$2,$3)
  RETURNING id,name,slug,status,seat_limit,business_tier,entitlements,billing_status,trial_ends_at,created_at
 `,[name,slug,req.member.id])).rows[0];
 await db.query("INSERT INTO organization_memberships(organization_id,user_id,role,status) VALUES($1,$2,'OWNER','ACTIVE')",[org.id,req.member.id]);
 await db.query("INSERT INTO organization_billing_accounts(organization_id,seat_quantity,status) VALUES($1,$2,'TRIAL')",[org.id,org.seat_limit]);
 const ws=(await db.query("INSERT INTO organization_workspaces(organization_id,name) VALUES($1,$2) RETURNING id,name",[org.id,name+" workspace"])).rows[0];
 await writeOrgAudit({orgId:org.id,actor:req.member.id,action:"ORG_CREATED",targetType:"organization",targetId:org.id,metadata:{seat_limit:org.seat_limit}});
 res.status(201).json({organization:org,workspace:ws});
}