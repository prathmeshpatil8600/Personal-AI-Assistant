import { db } from "hatchable";
export const access="member"; export const methods=["GET"];
export default async function(req,res){
 const [r,t]=await Promise.all([
  db.query("SELECT id,title,message,remind_at,'reminder' AS type FROM reminders WHERE user_id=$1 AND status='SCHEDULED' AND remind_at <= now() ORDER BY remind_at DESC LIMIT 20",[req.member.id]),
  db.query("SELECT id,title,priority,due_at,'task' AS type FROM tasks WHERE user_id=$1 AND status<>'COMPLETED' AND status<>'CANCELLED' AND due_at IS NOT NULL AND due_at <= now() ORDER BY due_at DESC LIMIT 20",[req.member.id])
 ]);
 res.json([...r.rows,...t.rows].sort((a,b)=>new Date(b.remind_at||b.due_at)-new Date(a.remind_at||a.due_at)));
}