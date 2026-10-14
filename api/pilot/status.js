import { db } from "hatchable";
export const access="user";
export const methods=["GET","POST"];
export default async function(req,res){
 const uid=req.user.id;
 if(req.method==="POST"){
  await db.query(`INSERT INTO pilot_participants(user_id,status,activated_at,last_seen_at)
   VALUES($1,'ACTIVE',now(),now())
   ON CONFLICT(user_id) DO UPDATE SET last_seen_at=now(),status=CASE WHEN pilot_participants.status='INVITED' THEN 'ACTIVE' ELSE pilot_participants.status END,
   activated_at=COALESCE(pilot_participants.activated_at,now()),updated_at=now()`,[uid]);
 }
 const p=(await db.query("SELECT cohort,status,activated_at,last_seen_at,created_at FROM pilot_participants WHERE user_id=$1",[uid])).rows[0];
 if(!p)return res.status(403).json({error:"pilot_access_required",message:"This closed pilot is invite-only."});
 if(!["INVITED","ACTIVE"].includes(p.status))return res.status(403).json({error:"pilot_access_paused",status:p.status});
 await db.query("UPDATE pilot_participants SET last_seen_at=now(),status=CASE WHEN status='INVITED' THEN 'ACTIVE' ELSE status END,activated_at=COALESCE(activated_at,now()),updated_at=now() WHERE user_id=$1",[uid]);
 const o=(await db.query("SELECT status,completed_steps,first_chat_at,first_task_at,first_memory_at,first_document_at,first_integration_at,completed_at FROM user_onboarding WHERE user_id=$1",[uid])).rows[0]||{status:"STARTED",completed_steps:[]};
 res.json({pilot:{...p,status:p.status==="INVITED"?"ACTIVE":p.status},onboarding:o});
}