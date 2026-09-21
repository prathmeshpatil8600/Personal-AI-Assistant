import { ai, db } from "hatchable";
export const access="member";
export const methods=["POST"];
export default async function(req,res){
 const uid=req.member.id;
 const [tasks,events,stats]=await Promise.all([
  db.query("SELECT title,priority,status,due_at FROM tasks WHERE user_id=$1 AND status NOT IN ('COMPLETED','CANCELLED') ORDER BY due_at NULLS LAST LIMIT 30",[uid]),
  db.query("SELECT title,start_at,end_at,location FROM calendar_events WHERE user_id=$1 AND status='SCHEDULED' AND start_at >= now() AND start_at < now()+interval '7 days' ORDER BY start_at LIMIT 30",[uid]),
  db.query("SELECT stat_date,tasks_completed,tasks_overdue,events_count FROM productivity_daily WHERE user_id=$1 ORDER BY stat_date DESC LIMIT 14",[uid])
 ]);
 const result=await ai.generateText({model:"sonnet",purpose:"productivity_insights",userId:uid,maxSteps:3,
 system:"You are a practical productivity analyst. Analyze the user's supplied workspace data only. Return concise, actionable insights. Do not invent facts. Organize as: Priorities, Risks, Schedule, Suggested actions.",
 messages:[{role:"user",content:JSON.stringify({tasks:tasks.rows,events:events.rows,stats:stats.rows})}]});
 res.json({insights:result.text||"",generated_at:new Date().toISOString()});
}