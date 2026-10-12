import { db } from "hatchable";
export const access="user";
export const methods=["GET"];
export default async function(req,res){
 const uid=req.user.id;
 const r=await db.query(`SELECT COALESCE(SUM(tasks_created),0)::int tasks_created,COALESCE(SUM(tasks_completed),0)::int tasks_completed,COALESCE(SUM(tasks_overdue),0)::int tasks_overdue,COALESCE(SUM(notes_created),0)::int notes_created,COALESCE(SUM(events_count),0)::int events_count FROM productivity_daily WHERE user_id=$1 AND stat_date >= current_date-29`,[uid]);
 const recent=await db.query("SELECT stat_date,tasks_completed,tasks_overdue,events_count FROM productivity_daily WHERE user_id=$1 ORDER BY stat_date DESC LIMIT 14",[uid]);
 res.json({thirty_day:r.rows[0],recent:recent.rows.reverse()});
}