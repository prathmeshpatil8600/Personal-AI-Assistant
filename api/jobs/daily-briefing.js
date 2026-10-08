import { db } from "hatchable";
import { generateText } from "../../lib/ai-router.js";
import { requireFeature,requireUnits } from "../../lib/entitlements.js";
export const access="scheduler";
export const methods=["POST"];
export default async function(req,res){
 const users=await db.query("SELECT DISTINCT user_id FROM tasks UNION SELECT DISTINCT user_id FROM reminders UNION SELECT DISTINCT user_id FROM calendar_events");
 let created=0, failed=0;
 for(const u of users.rows){
  const uid=u.user_id;
  const featureGate=await requireFeature(uid,"scheduled_briefings");const unitGate=await requireUnits(uid,1);if(!featureGate.ok||!unitGate.ok)continue;
  const [t,e,r]=await Promise.all([
   db.query("SELECT title,priority,status,due_at FROM tasks WHERE user_id=$1 AND status NOT IN ('COMPLETED','CANCELLED') AND (due_at IS NULL OR due_at < now()+interval '2 days') ORDER BY due_at NULLS LAST LIMIT 12",[uid]),
   db.query("SELECT title,start_at,end_at FROM calendar_events WHERE user_id=$1 AND status='SCHEDULED' AND start_at >= now() AND start_at < now()+interval '1 day' ORDER BY start_at",[uid]),
   db.query("SELECT title,remind_at FROM reminders WHERE user_id=$1 AND status='SCHEDULED' AND remind_at >= now() AND remind_at < now()+interval '1 day' ORDER BY remind_at",[uid])
  ]);
  try{
   const aiResult=await generateText({
    model:"google.gemini",
    purpose:"daily_briefing",
    userId:uid,
    maxSteps:2,
    system:"Write a concise daily briefing from the supplied data only. Mention priorities, today's schedule, and overdue/near-term risks. Never invent information.",
    messages:[{role:"user",content:JSON.stringify({tasks:t.rows,events:e.rows,reminders:r.rows})}]
   });
   await db.query("INSERT INTO assistant_notifications(user_id,type,title,message,source_key) VALUES($1,'BRIEFING','Your daily briefing',$2,'briefing:'||current_date::text ON CONFLICT(user_id,source_key) DO UPDATE SET message=EXCLUDED.message,created_at=now(),read_at=NULL",[uid,aiResult.text||"No briefing available."]);
   created++;
  }catch(e){ failed++; }
 }
 res.json({created,failed,generated_at:new Date().toISOString()});
}