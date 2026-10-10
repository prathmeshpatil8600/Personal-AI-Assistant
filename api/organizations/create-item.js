import { db } from "hatchable";
import { requireOrgWrite,orgError,writeOrgAudit } from "../../lib/organizations.js";
export const access="member";
export const methods=["POST"];
export default async function(req,res){
 const orgId=String(req.body?.organization_id||"").trim(),type=String(req.body?.item_type||"NOTE").toUpperCase(),title=String(req.body?.title||"").trim(),content=String(req.body?.content||"");
 if(!orgId||!["NOTE","TASK","LINK","DECISION"].includes(type)||!title||title.length>200||content.length>20000)return res.status(400).json({error:"Valid organization_id, item_type, title and content are required."});
 const gate=await requireOrgWrite(req.member.id,orgId,"MEMBER");if(!gate.ok)return orgError(res,gate);
 const ws=(await db.query("SELECT id FROM organization_workspaces WHERE organization_id=$1",[orgId])).rows[0];if(!ws)return res.status(409).json({error:"workspace_missing"});
 const row=(await db.query("INSERT INTO organization_shared_items(organization_id,workspace_id,item_type,title,content,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$6) RETURNING id,item_type,title,content,status,created_at,updated_at",[orgId,ws.id,type,title,content,req.member.id])).rows[0];
 await writeOrgAudit({orgId,actor:req.member.id,action:"WORKSPACE_ITEM_CREATED",targetType:"shared_item",targetId:row.id,metadata:{item_type:type}});
 res.status(201).json(row);
}