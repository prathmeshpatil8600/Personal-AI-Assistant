import { db } from "hatchable";
export const access="admin";
export const methods=["GET","POST"];
export default async function(req,res){
 if(req.method==="GET"){
  const rows=(await db.query("SELECT id,user_id,category,severity,message,page,status,created_at,updated_at,resolved_at FROM pilot_feedback ORDER BY CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,created_at DESC LIMIT 500")).rows;
  return res.json(rows);
 }
 const id=String(req.body?.id||"").trim(),status=String(req.body?.status||"").toUpperCase();
 if(!id||!["OPEN","TRIAGED","RESOLVED","WONT_FIX"].includes(status))return res.status(400).json({error:"id and valid status are required"});
 const row=(await db.query("UPDATE pilot_feedback SET status=$2,resolved_at=CASE WHEN $2 IN ('RESOLVED','WONT_FIX') THEN now() ELSE NULL END,updated_at=now() WHERE id=$1 RETURNING id,status,resolved_at",[id,status])).rows[0];
 if(!row)return res.status(404).json({error:"feedback_not_found"});
 res.json(row);
}