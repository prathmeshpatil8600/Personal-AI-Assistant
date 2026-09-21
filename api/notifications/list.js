import { db } from "hatchable";
export const access="member";
export const methods=["GET"];
export default async function(req,res){
 const r=await db.query("SELECT id,type,title,message,read_at,created_at FROM assistant_notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",[req.member.id]);
 res.json(r.rows);
}