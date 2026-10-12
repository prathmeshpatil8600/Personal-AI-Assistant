import { db } from "hatchable";
export const access="user";
export const methods = ["GET"];
export default async function(req,res){
 const {rows}=await db.query("SELECT id,title,message,remind_at,recurrence,status,created_at,updated_at FROM reminders WHERE user_id = $1 ORDER BY remind_at NULLS LAST, created_at DESC",[req.user.id]);res.json(rows);
}