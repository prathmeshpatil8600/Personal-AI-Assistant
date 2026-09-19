import { db } from "hatchable";
export const access = "member";
export const methods = ["GET"];
export default async function(req,res){
 const {rows}=await db.query("SELECT id,title,message,remind_at,recurrence,status,created_at,updated_at FROM reminders WHERE user_id = $1 ORDER BY remind_at NULLS LAST, created_at DESC",[req.member.id]);res.json(rows);
}