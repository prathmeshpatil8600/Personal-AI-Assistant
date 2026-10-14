import { db } from "hatchable";
const COLS={chat:"first_chat_at",task:"first_task_at",memory:"first_memory_at",document:"first_document_at",integration:"first_integration_at"};
export async function markOnboardingStep(userId,step){
 const col=COLS[step];if(!userId||!col)return;
 try{
  const row=(await db.query(`INSERT INTO user_onboarding(user_id,completed_steps,${col})
   VALUES($1,jsonb_build_array($2),now())
   ON CONFLICT(user_id) DO UPDATE SET
    completed_steps=CASE WHEN user_onboarding.completed_steps ? $2 THEN user_onboarding.completed_steps ELSE user_onboarding.completed_steps||jsonb_build_array($2) END,
    ${col}=COALESCE(user_onboarding.${col},now()),
    updated_at=now()
   RETURNING completed_steps`,[userId,step])).rows[0];
  const steps=Array.isArray(row?.completed_steps)?row.completed_steps:[];
  if(steps.length>=3)await db.query("UPDATE user_onboarding SET status='COMPLETED',completed_at=COALESCE(completed_at,now()),updated_at=now() WHERE user_id=$1",[userId]);
 }catch(e){
  console.error("pilot_onboarding_mark_failed",String(e?.message||e).slice(0,300));
 }
}