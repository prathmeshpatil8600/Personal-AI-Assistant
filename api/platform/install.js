import { db } from "hatchable";
import { requireOrgWrite,orgError,writeOrgAudit } from "../../lib/organizations.js";
export const access="member";
export const methods=["POST"];
export default async function(req,res){
 const orgId=String(req.body?.organization_id||"").trim(),slug=String(req.body?.integration_slug||"").trim();
 if(!orgId||!slug)return res.status(400).json({error:"organization_id and integration_slug are required"});
 const gate=await requireOrgWrite(req.member.id,orgId,"ADMIN");if(!gate.ok)return orgError(res,gate);
 const item=(await db.query("SELECT slug,permissions,status,install_mode FROM integration_marketplace WHERE slug=$1",[slug])).rows[0];
 if(!item||item.status!=="AVAILABLE")return res.status(409).json({error:"integration_unavailable"});
 const row=(await db.query(`
  INSERT INTO integration_installations(organization_id,integration_slug,installed_by,status,granted_permissions)
  VALUES($1,$2,$3,'ACTIVE',$4::jsonb)
  ON CONFLICT(organization_id,integration_slug) DO UPDATE SET status='ACTIVE',granted_permissions=EXCLUDED.granted_permissions,installed_by=EXCLUDED.installed_by,updated_at=now()
  RETURNING id,integration_slug,status,granted_permissions,installed_at,updated_at
 `,[orgId,slug,req.member.id,JSON.stringify(item.permissions||[])])).rows[0];
 await writeOrgAudit({orgId,actor:req.member.id,action:"INTEGRATION_INSTALLED",targetType:"integration",targetId:slug,metadata:{permissions:item.permissions}});
 res.json(row);
}