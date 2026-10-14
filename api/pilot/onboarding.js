import { db } from "hatchable";
export const access="user";
export const methods=["GET","POST"];
const STEPS=new Set(["chat","task","memory","document","integration"]);
export default async function(req,res){
 const uid=req.user.id;
 if(req.method==="POST"){
  const step=String(req.body?.step||"").toLowerCase(),action=String(req.body?.action||"").toLowerCase();
  if(action==="skip"){
   const row=(await db.query(`INSERT INTO user_onboarding(user_id,status,completed_at) VALUES($1,'SKIPPED',now())
    ON CONFLICT(user_id) DO UPDATE SET status='SKIPPED',completed_at=now(),updated_at=now()
    RETURNING *`,[uid])).rows[0];return res.json(row);
  }
  if(!STEPS.has(step))return res.status(400).json({error:"invalid_step"});
  const col={chat:"first_chat_at",task:"first_task_at",memory:"first_memory_at",document:"first_document_at",integration:"first_integration_at"}[step];
  const row=(await db.query(`INSERT INTO user_onboarding(user_id,completed_steps,${col})
   VALUES($1,jsonb_build_array($2),now())
   ON CONFLICT(user_id) DO UPDATE SET
    completed_steps=CASE WHEN user_onboarding.completed_steps ? $2 THEN user_onboarding.completed_steps ELSE user_onboarding.completed_steps||jsonb_build_array($2) END,
    ${col}=COALESCE(user_onboarding.${col},now()),updated_at=now()
   RETURNING *`,[uid,step])).rows[0];
  const steps=Array.isArray(row.completed_steps)?row.completed_steps:[];
  if(steps.length>=3)await db.query("UPDATE user_onboarding SET status='COMPLETED',completed_at=COALESCE(completed_at,now()),updated_at=now() WHERE user_id=$1",[uid]);
 }
 const row=(await db.query("SELECT * FROM user_onboarding WHERE user_id=$1",[uid])).rows[0]||{user_id:uid,status:"STARTED",completed_steps:[]};
 res.json(row);
}