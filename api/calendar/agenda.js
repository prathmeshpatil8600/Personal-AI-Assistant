import { db } from "hatchable";
export const access="member"; export const methods=["GET"];
export default async function(req,res){
 const day=req.query?.date?new Date(req.query.date):new Date(); if(Number.isNaN(day.getTime()))return res.status(400).json({error:"Invalid date."});
 const start=new Date(day);start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+1);
 const [events,tasks]=await Promise.all([
  db.query("SELECT id,title,start_at,end_at,all_day,location FROM calendar_events WHERE user_id=$1 AND status='SCHEDULED' AND start_at >= $2 AND start_at < $3 ORDER BY start_at",[req.member.id,start,end]),
  db.query("SELECT id,title,priority,status,due_at FROM tasks WHERE user_id=$1 AND status<>'CANCELLED' AND due_at >= $2 AND due_at < $3 ORDER BY due_at",[req.member.id,start,end])
 ]);
 res.json({events:events.rows,tasks:tasks.rows});
}