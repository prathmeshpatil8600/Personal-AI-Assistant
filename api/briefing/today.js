import { db } from "hatchable";
export const access="member";
export const methods=["GET"];
export default async function(req,res){
 const userId=req.member.id, now=new Date();
 const start=new Date(now); start.setHours(0,0,0,0);
 const end=new Date(start); end.setDate(end.getDate()+1);
 const [tasks,events,reminders,overdue]=await Promise.all([
  db.query("SELECT id,title,priority,status,due_at FROM tasks WHERE user_id=$1 AND status<>'CANCELLED' AND due_at >= $2 AND due_at < $3 ORDER BY CASE priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,due_at NULLS LAST",[userId,start,end]),
  db.query("SELECT id,title,start_at,end_at,all_day,location FROM calendar_events WHERE user_id=$1 AND status='SCHEDULED' AND start_at >= $2 AND start_at < $3 ORDER BY start_at",[userId,start,end]),
  db.query("SELECT id,title,message,remind_at,status FROM reminders WHERE user_id=$1 AND status='SCHEDULED' AND remind_at >= $2 AND remind_at < $3 ORDER BY remind_at",[userId,start,end]),
  db.query("SELECT id,title,priority,status,due_at FROM tasks WHERE user_id=$1 AND status<>'COMPLETED' AND status<>'CANCELLED' AND due_at < $2 ORDER BY due_at",[userId,start])
 ]);
 const blocks=events.rows.filter(e=>e.end_at).map(e=>({start:new Date(e.start_at),end:new Date(e.end_at),title:e.title}));
 const conflicts=[];
 for(let i=0;i<blocks.length;i++)for(let j=i+1;j<blocks.length;j++)if(blocks[i].start<blocks[j].end&&blocks[j].start<blocks[i].end)conflicts.push({first:blocks[i].title,second:blocks[j].title});
 const rank=t=>({URGENT:4,HIGH:3,MEDIUM:2,LOW:1}[t.priority]||1)+(t.due_at?1:0);
 const focus=[...tasks.rows].filter(t=>t.status!=="COMPLETED").sort((a,b)=>rank(b)-rank(a)).slice(0,5);
 res.json({date:start.toISOString().slice(0,10),tasks:tasks.rows,events:events.rows,reminders:reminders.rows,overdue:overdue.rows,conflicts,focus});
}