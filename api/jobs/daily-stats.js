import { db } from "hatchable";
export const access="scheduler";
export const methods=["POST"];
export default async function(req,res){
 const r=await db.query(`INSERT INTO productivity_daily(user_id,stat_date,tasks_created,tasks_completed,tasks_overdue,notes_created,events_count,reminders_due)
 SELECT u.id,current_date,
 (SELECT count(*) FROM tasks t WHERE t.user_id=u.id AND t.created_at >= current_date),
 (SELECT count(*) FROM tasks t WHERE t.user_id=u.id AND t.status='COMPLETED' AND t.updated_at >= current_date),
 (SELECT count(*) FROM tasks t WHERE t.user_id=u.id AND t.status NOT IN ('COMPLETED','CANCELLED') AND t.due_at < current_date),
 (SELECT count(*) FROM notes n WHERE n.user_id=u.id AND n.deleted_at IS NULL AND n.created_at >= current_date),
 (SELECT count(*) FROM calendar_events e WHERE e.user_id=u.id AND e.status='SCHEDULED' AND e.start_at >= current_date AND e.start_at < current_date + interval '1 day'),
 (SELECT count(*) FROM reminders m WHERE m.user_id=u.id AND m.status='SCHEDULED' AND m.remind_at >= current_date AND m.remind_at < current_date + interval '1 day')
 FROM users u
 ON CONFLICT(user_id,stat_date) DO UPDATE SET tasks_created=EXCLUDED.tasks_created,tasks_completed=EXCLUDED.tasks_completed,tasks_overdue=EXCLUDED.tasks_overdue,notes_created=EXCLUDED.notes_created,events_count=EXCLUDED.events_count,reminders_due=EXCLUDED.reminders_due,updated_at=now()
 RETURNING id`);
 res.json({upserted:r.rowCount});
}