import { db } from "hatchable";
import { requireOrgRole,orgError } from "../../lib/organizations.js";
export const access="member";
export const methods=["GET"];
export default async function(req,res){
 const orgId=String(req.query?.organization_id||"").trim();
 let installations=[];
 if(orgId){
  const gate=await requireOrgRole(req.member.id,orgId,"MEMBER");if(!gate.ok)return orgError(res,gate);
  installations=(await db.query("SELECT integration_slug,status,granted_permissions,installed_at,updated_at FROM integration_installations WHERE organization_id=$1",[orgId])).rows;
 }
 const catalog=(await db.query("SELECT slug,display_name,description,category,provider,permissions,status,install_mode FROM integration_marketplace WHERE status<>'DISABLED' ORDER BY sort_order,display_name")).rows;
 res.json({catalog,installations});
}