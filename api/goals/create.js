import { db } from "hatchable";
export const access="member";
export const methods=["POST"];
export default async function(req,res){
 const b=req.body||{}; const title=String(b.title||"").trim();
 if(!title) return res.status(400).json({error:"Title is required"});
 const progress=Math.max(0,Math.min(100,Number(b.progress_percent||0)));
 const {rows}=await db.query("INSERT INTO goals(user_id,title,description,category,target_date,progress_percent) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",[req.member.id,title,String(b.description||""),String(b.category||"GENERAL"),b.target_date||null,progress]);
 res.status(201).json(rows[0]);
}