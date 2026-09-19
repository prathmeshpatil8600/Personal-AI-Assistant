import { db, auth } from "hatchable";

export const access = "public";
export const methods = ["GET"];

export default async function (req, res) {
  const user = await auth.requireUser(req, res);
  if (!user) return;
  const userId = user.id;

  const [taskResult, noteResult] = await Promise.all([
    db.query("SELECT id, title, priority, status, due_at FROM tasks WHERE user_id = $1 AND status <> 'CANCELLED' ORDER BY CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END, due_at NULLS LAST, created_at DESC LIMIT 8", [userId]),
    db.query("SELECT count(*)::int AS count FROM notes WHERE user_id = $1 AND deleted_at IS NULL", [userId]).catch(() => ({rows:[{count:0}]}))
  ]);

  const items = taskResult.rows;
  const pending = items.filter(t => t.status !== "COMPLETED").length;
  const completed = items.filter(t => t.status === "COMPLETED").length;
  const now = new Date();
  const overdue = items.filter(t => t.status !== "COMPLETED" && t.due_at && new Date(t.due_at) < now).length;

  res.json({tasks:{pending, completed, overdue, items}, notes: noteResult.rows[0]?.count ?? 0});
}