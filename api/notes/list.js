import { db } from "hatchable";
export const access="user";
export const methods = ["GET"];
export default async function(req,res){
  const q=typeof req.query?.q==="string"?req.query.q.trim():"";
  const {rows}=await db.query(
    q ? "SELECT id,title,content,category,pinned,archived,created_at,updated_at FROM notes WHERE user_id = $1 AND deleted_at IS NULL AND (title ILIKE $2 OR content ILIKE $2) ORDER BY pinned DESC, updated_at DESC"
      : "SELECT id,title,content,category,pinned,archived,created_at,updated_at FROM notes WHERE user_id = $1 AND deleted_at IS NULL ORDER BY pinned DESC, updated_at DESC",
    q?[req.user.id,"%"+q+"%"]:[req.user.id]
  );
  res.json(rows);
}