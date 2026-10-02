import { db } from "hatchable";

export const access = "member";
export const methods = ["GET"];

export default async function (req, res) {
  const { rows } = await db.query(
    "SELECT id, title, description, priority, status, due_at, created_at, updated_at FROM tasks WHERE user_id = $1 ORDER BY due_at NULLS LAST, created_at DESC",
    [req.member.id]
  );
  res.json(rows);
}