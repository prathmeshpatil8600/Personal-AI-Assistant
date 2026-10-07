import { db } from "hatchable";
export const access="member";
export const methods=["GET"];
export default async function(req,res){
  const {rows}=await db.query("SELECT id,category,memory_key,memory_value,source,importance,confidence,last_accessed_at,access_count,created_at,updated_at FROM memories WHERE user_id=$1 ORDER BY importance DESC,updated_at DESC",[req.member.id]);
  res.json(rows);
}