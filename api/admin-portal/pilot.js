import { db } from "hatchable";
import { requireAdminPortal } from "../../lib/admin-portal-auth.js";
import { computePilotReview,savePilotReview } from "../../lib/pilot-review.js";
export const access="user";
export const methods=["GET","POST","DELETE"];

export default async function(req,res){
 const admin=requireAdminPortal(req,res);if(!admin)return;
 if(req.method==="GET"){
  const [participants,feedback,review]=await Promise.all([
   db.query("SELECT p.user_id,u.email,u.name,p.cohort,p.status,p.activated_at,p.last_seen_at,p.created_at,p.updated_at FROM pilot_participants p LEFT JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC LIMIT 500"),
   db.query("SELECT id,user_id,category,severity,message,page,status,created_at,updated_at,resolved_at FROM pilot_feedback ORDER BY CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,created_at DESC LIMIT 500"),
   computePilotReview("PILOT_1")
  ]);
  return res.json({participants:participants.rows,feedback:feedback.rows,review});
 }
 const action=String(req.body?.action||"").toLowerCase();
 if(action==="add_participant"){
  const email=String(req.body?.email||"").trim().toLowerCase();
  const u=(await db.query("SELECT id,email,name FROM users WHERE lower(email)=lower($1) LIMIT 1",[email])).rows[0];
  if(!u)return res.status(404).json({error:"user_not_found",message:"User must sign in once before being added."});
  const row=(await db.query("INSERT INTO pilot_participants(user_id,cohort,status,invited_by) VALUES($1,'PILOT_1','INVITED',$2) ON CONFLICT(user_id) DO UPDATE SET status='INVITED',cohort='PILOT_1',updated_at=now() RETURNING *",[u.id,admin.email])).rows[0];
  return res.json({...row,email:u.email,name:u.name});
 }
 if(action==="feedback_status"){
  const id=String(req.body?.id||""),status=String(req.body?.status||"").toUpperCase();
  if(!["OPEN","TRIAGED","RESOLVED","WONT_FIX"].includes(status))return res.status(400).json({error:"invalid_status"});
  const row=(await db.query("UPDATE pilot_feedback SET status=$2,resolved_at=CASE WHEN $2 IN ('RESOLVED','WONT_FIX') THEN now() ELSE NULL END,updated_at=now() WHERE id=$1 RETURNING id,status,resolved_at",[id,status])).rows[0];
  return res.json(row||{});
 }
 if(action==="save_review")return res.json(await savePilotReview({cohort:"PILOT_1",checkpoint:"MANUAL"}));
 return res.status(400).json({error:"invalid_action"});
}