import { db } from "hatchable";
import { requireOrgRole,orgError,writeOrgAudit } from "../../lib/organizations.js";
export const access="member";
export const methods=["GET","POST"];
const accents=new Set(["forest","indigo","ocean","amber","rose"]);
function safeHttpsUrl(v){if(!v)return null;try{const u=new URL(String(v));return u.protocol==="https:"?u.href:null}catch{return null}}
export default async function(req,res){
 const orgId=String((req.method==="GET"?req.query?.organization_id:req.body?.organization_id)||"").trim();
 if(!orgId)return res.status(400).json({error:"organization_id is required"});
 const gate=await requireOrgRole(req.member.id,orgId,req.method==="POST"?"ADMIN":"MEMBER");if(!gate.ok)return orgError(res,gate);
 if(req.method==="GET"){
  const row=(await db.query("SELECT organization_id,brand_name,accent_key,logo_url,support_email,welcome_message,enabled,updated_at FROM white_label_profiles WHERE organization_id=$1",[orgId])).rows[0];
  return res.json(row||{organization_id:orgId,brand_name:gate.membership.name,accent_key:"forest",logo_url:null,support_email:null,welcome_message:"",enabled:false});
 }
 const b=req.body||{},brand=String(b.brand_name||"").trim(),accent=String(b.accent_key||"forest"),support=String(b.support_email||"").trim().slice(0,180)||null,welcome=String(b.welcome_message||"").trim().slice(0,500),logo=b.logo_url?safeHttpsUrl(b.logo_url):null,enabled=Boolean(b.enabled);
 const validEmail=!support||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(support);
 if(brand.length<2||brand.length>80||!accents.has(accent)||(b.logo_url&&!logo)||!validEmail)return res.status(400).json({error:"Invalid branding settings."});
 if(enabled&&(gate.membership.business_tier!=="BUSINESS_CUSTOM"||gate.membership.billing_status!=="ACTIVE"))return res.status(403).json({error:"white_label_requires_active_custom_business"});
 const row=(await db.query(`
  INSERT INTO white_label_profiles(organization_id,brand_name,accent_key,logo_url,support_email,welcome_message,enabled)
  VALUES($1,$2,$3,$4,$5,$6,$7)
  ON CONFLICT(organization_id) DO UPDATE SET brand_name=EXCLUDED.brand_name,accent_key=EXCLUDED.accent_key,logo_url=EXCLUDED.logo_url,support_email=EXCLUDED.support_email,welcome_message=EXCLUDED.welcome_message,enabled=EXCLUDED.enabled,updated_at=now()
  RETURNING organization_id,brand_name,accent_key,logo_url,support_email,welcome_message,enabled,updated_at
 `,[orgId,brand,accent,logo,support,welcome,enabled])).rows[0];
 await writeOrgAudit({orgId,actor:req.member.id,action:"WHITE_LABEL_UPDATED",targetType:"organization",targetId:orgId,metadata:{enabled,accent_key:accent}});
 res.json(row);
}