import { db } from "hatchable";
export const access="member";
export const methods=["POST"];
export default async function(req,res){
 const {id}=req.body||{}; if(!id)return res.status(400).json({error:"Habit id is required"});
 const h=(await db.query("SELECT * FROM habits WHERE id=$1 AND user_id=$2",[id,req.member.id])).rows[0]; if(!h)return res.status(404).json({error:"Habit not found"});
 const {rows}=await db.query("UPDATE habits SET current_streak=current_streak+1,last_completed_at=now(),updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING *",[id,req.member.id]); res.json(rows[0]);
}