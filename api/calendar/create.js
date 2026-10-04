import { db } from "hatchable";
import { normalizeRecurrence } from "../../lib/recurrence.js";
export const access="member"; export const methods=["POST"];
export default async function(req,res){
 const b=req.body||{},title=typeof b.title==="string"?b.title.trim():"",start=new Date(b.start_at),end=b.end_at?new Date(b.end_at):null;
 if(!title)return res.status(400).json({error:"Title is required."});
 if(Number.isNaN(start.getTime())||(end&&Number.isNaN(end.getTime())))return res.status(400).json({error:"Invalid event time."});
 if(end&&end<start)return res.status(400).json({error:"End time must be after start time."});
 const reminder=Number.isInteger(b.reminder_minutes)?Math.max(0,b.reminder_minutes):15;
 let recurrence=null;try{recurrence=normalizeRecurrence(b.recurrence)}catch(e){return res.status(400).json({error:e.message})}
 const r=await db.query("INSERT INTO calendar_events(user_id,title,description,start_at,end_at,all_day,location,recurrence,reminder_minutes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",[req.member.id,title,typeof b.description==="string"?b.description:"",start,end,Boolean(b.all_day),typeof b.location==="string"?b.location:"",recurrence,reminder]);
 res.status(201).json(r.rows[0]);
}