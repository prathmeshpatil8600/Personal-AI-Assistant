import { db, auth } from "hatchable";

export const access = "public";
export const methods = ["GET"];

export default async function (req, res) {
  const user = await auth.requireUser(req, res);
  if (!user) return;
  const { rows } = await db.query(
    "SELECT id, title, description, priority, status, due_at, created_at, updated_at FROM tasks WHERE user_id = $1 ORDER BY due_at NULLS LAST, created_at DESC",
    [user.id]
  );
  res.json(rows);
}