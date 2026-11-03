import { db } from "hatchable";
import { requireAdminPortal } from "../../lib/admin-portal-auth.js";
export const access="user";
export const methods=["GET","POST"];
export default async function(req,res){
 const admin=requireAdminPortal(req,res);if(!admin)return;
 if(req.method==="POST"){
  const action=String(req.body?.action||"");
  if(action==="grievance_status"){
   const id=String(req.body?.id||""),status=String(req.body?.status||"").toUpperCase(),resolution=String(req.body?.resolution||"").slice(0,4000);
   if(!["OPEN","IN_REVIEW","RESOLVED","REJECTED"].includes(status))return res.status(400).json({error:"invalid_status"});
   const row=(await db.query("UPDATE privacy_grievances SET status=$2,resolution=$3,resolved_at=CASE WHEN $2 IN ('RESOLVED','REJECTED') THEN now() ELSE NULL END,updated_at=now() WHERE id=$1 RETURNING id,status,resolution,resolved_at",[id,status,resolution||null])).rows[0];
   if(!row)return res.status(404).json({error:"grievance_not_found"});
   return res.json(row);
  }
  return res.status(400).json({error:"invalid_action"});
 }
 const [grievances,deletions]=await Promise.all([
  db.query("SELECT g.id,g.user_id,u.email,g.category,g.message,g.status,g.resolution,g.created_at,g.updated_at,g.resolved_at FROM privacy_grievances g LEFT JOIN users u ON u.id=g.user_id ORDER BY g.created_at DESC LIMIT 300"),
  db.query("SELECT d.id,d.user_id,u.email,d.status,d.requested_at,d.execute_after,d.cancelled_at,d.completed_at,d.blockers,d.updated_at FROM account_deletion_requests d LEFT JOIN users u ON u.id=d.user_id ORDER BY d.requested_at DESC LIMIT 300")
 ]);
 res.json({grievances:grievances.rows,deletions:deletions.rows});
}