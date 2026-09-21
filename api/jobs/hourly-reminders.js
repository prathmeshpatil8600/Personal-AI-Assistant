import { db } from "hatchable";
export const access="scheduler";
export const methods=["POST"];
export default async function(req,res){
 const now=new Date(), next=new Date(now); next.setMinutes(next.getMinutes()+60);
 const r=await db.query(`INSERT INTO assistant_notifications(user_id,type,title,message,source_key)
 SELECT user_id,'REMINDER',title,message,'reminder:'||id::text
 FROM reminders
 WHERE status='SCHEDULED' AND remind_at <= $1 AND remind_at > $2
 ON CONFLICT(user_id,source_key) DO NOTHING
 RETURNING id`,[now,new Date(now.getTime()-60*60*1000)]);
 res.json({created:r.rowCount,triggered_at:now.toISOString()});
}