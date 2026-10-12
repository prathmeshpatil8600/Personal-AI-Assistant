import { db } from "hatchable";
import { generateText } from "../../lib/ai-router.js";
import { enforceUserRateLimit,rateLimitError } from "../../lib/rate-limit.js";
export const access="user";
export const methods=["POST"];
export default async function(req,res){
 const uid=req.user.id;
 const rate=await enforceUserRateLimit(uid,"ai_insights",{limit:10,windowSeconds:60});if(!rate.ok)return rateLimitError(res,rate);
 const [tasks,events,stats]=await Promise.all([
  db.query("SELECT title,priority,status,due_at FROM tasks WHERE user_id=$1 AND status NOT IN ('COMPLETED','CANCELLED') ORDER BY due_at NULLS LAST LIMIT 30",[uid]),
  db.query("SELECT title,start_at,end_at,location FROM calendar_events WHERE user_id=$1 AND status='SCHEDULED' AND start_at >= now() AND start_at < now()+interval '7 days' ORDER BY start_at LIMIT 30",[uid]),
  db.query("SELECT stat_date,tasks_completed,tasks_overdue,events_count FROM productivity_daily WHERE user_id=$1 ORDER BY stat_date DESC LIMIT 14",[uid])
 ]);
 const result=await generateText({
  model:"google.gemini",
  purpose:"productivity_insights",
  userId:uid,
  maxSteps:3,
  system:"You are a practical productivity analyst. Analyze the user's supplied workspace data only. Return concise, actionable insights. Do not invent facts. Organize as: Priorities, Risks, Schedule, Suggested actions.",
  messages:[{role:"user",content:JSON.stringify({tasks:tasks.rows,events:events.rows,stats:stats.rows})}],
  responseStyle:"concise",cacheTtlSeconds:300
 });
 res.json({insights:result.text||"",generated_at:new Date().toISOString(),provider:result.provider,model:result.model});
}