import { db } from "hatchable";
export const access="member";
export const methods=["GET"];
export default async function(req,res){
 const {rows}=await db.query("SELECT * FROM habits WHERE user_id=$1 ORDER BY active DESC, created_at DESC",[req.member.id]); res.json(rows);
}