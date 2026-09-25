import { db } from "hatchable";
export const access="member";
export const methods=["GET"];
export default async function(req,res){
 const {rows}=await db.query("SELECT * FROM goals WHERE user_id=$1 AND status <> 'ARCHIVED' ORDER BY CASE status WHEN 'ACTIVE' THEN 0 WHEN 'PAUSED' THEN 1 ELSE 2 END, target_date NULLS LAST, created_at DESC",[req.member.id]);
 res.json(rows);
}