import { db } from "hatchable";
import { requireOrgWrite,orgError,writeOrgAudit } from "../../lib/organizations.js";
export const access="user";
export const methods=["POST"];
export default async function(req,res){
 const orgId=String(req.body?.organization_id||"").trim(),id=String(req.body?.id||"").trim(),title=String(req.body?.title||"").trim(),content=String(req.body?.content||""),status=String(req.body?.status||"ACTIVE").toUpperCase();
 if(!orgId||!id||!title||title.length>200||content.length>20000||!["ACTIVE","DONE","ARCHIVED"].includes(status))return res.status(400).json({error:"Valid organization_id, id, title, content and status are required."});
 const gate=await requireOrgWrite(req.user.id,orgId,"MEMBER");if(!gate.ok)return orgError(res,gate);
 const row=(await db.query("UPDATE organization_shared_items SET title=$1,content=$2,status=$3,updated_by=$4,updated_at=now() WHERE id=$5 AND organization_id=$6 RETURNING id,item_type,title,content,status,updated_at",[title,content,status,req.user.id,id,orgId])).rows[0];
 if(!row)return res.status(404).json({error:"Workspace item not found."});
 await writeOrgAudit({orgId,actor:req.user.id,action:"WORKSPACE_ITEM_UPDATED",targetType:"shared_item",targetId:id,metadata:{status}});
 res.json(row);
}