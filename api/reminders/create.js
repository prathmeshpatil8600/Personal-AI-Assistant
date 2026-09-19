import { db } from "hatchable";
export const access = "member";
export const methods = ["POST"];
export default async function(req,res){
 const b=req.body||{},title=typeof b.title==="string"?b.title.trim():"";
 if(!title)return res.status(400).json({error:"Title is required."});
 const at=b.remind_at?new Date(b.remind_at):null;if(at&&Number.isNaN(at.getTime()))return res.status(400).json({error:"Invalid reminder time."});
 const {rows}=await db.query("INSERT INTO reminders (user_id,title,message,remind_at,recurrence) VALUES ($1,$2,$3,$4,$5) RETURNING id,title,message,remind_at,recurrence,status,created_at,updated_at",[req.member.id,title,typeof b.message==="string"?b.message:"",at,typeof b.recurrence==="string"?b.recurrence:null]);
 res.status(201).json(rows[0]);
}