import { db } from "hatchable";
export const access="user"; export const methods=["GET"];
export default async function(req,res){const r=await db.query("SELECT id,title,filename,content_type,status,error_message,created_at,updated_at FROM documents WHERE user_id=$1 ORDER BY created_at DESC",[req.user.id]);res.json(r.rows)}