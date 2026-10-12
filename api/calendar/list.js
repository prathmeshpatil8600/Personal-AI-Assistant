import { db } from "hatchable";
export const access="user"; export const methods=["GET"];
export default async function(req,res){
 const from=req.query?.from?new Date(req.query.from):new Date();
 const to=req.query?.to?new Date(req.query.to):new Date(from.getTime()+31*86400000);
 if(Number.isNaN(from.getTime())||Number.isNaN(to.getTime()))return res.status(400).json({error:"Invalid date range."});
 const r=await db.query("SELECT id,title,description,start_at,end_at,all_day,location,recurrence,reminder_minutes,status FROM calendar_events WHERE user_id=$1 AND status='SCHEDULED' AND start_at < $3 AND (end_at IS NULL OR end_at >= $2) ORDER BY start_at",[req.user.id,from,to]);
 res.json(r.rows);
}