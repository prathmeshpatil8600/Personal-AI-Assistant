import { db } from "hatchable";
export const access="user"; export const methods=["GET"];
export default async function(req,res){const r=await db.query("SELECT id,title,created_at,updated_at FROM conversations WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 50",[req.user.id]);res.json(r.rows)}