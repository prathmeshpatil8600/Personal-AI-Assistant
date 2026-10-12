import { db } from "hatchable";
export const access="user";
export const methods=["GET"];
export default async function(req,res){
 const {rows}=await db.query("SELECT * FROM habits WHERE user_id=$1 ORDER BY active DESC, created_at DESC",[req.user.id]); res.json(rows);
}