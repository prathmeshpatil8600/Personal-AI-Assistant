import { db } from "hatchable";
export const access="user";
export const methods=["POST"];
export default async function(req,res){
 const b=req.body||{}; const name=String(b.name||"").trim(); if(!name)return res.status(400).json({error:"Name is required"});
 const {rows}=await db.query("INSERT INTO habits(user_id,name,frequency,target_count) VALUES($1,$2,$3,$4) RETURNING *",[req.user.id,name,b.frequency||"DAILY",Math.max(1,Number(b.target_count||1))]);
 res.status(201).json(rows[0]);
}