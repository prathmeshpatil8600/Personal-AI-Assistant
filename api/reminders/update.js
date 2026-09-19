import { db } from "hatchable";
export const access = "member";
export const methods = ["PATCH"];
export default async function(req,res){
 const id=req.query?.id||req.params?.id;if(!id)return res.status(400).json({error:"Reminder id is required."});
 const b=req.body||{};const fields=[],values=[];
 for(const k of ["title","message","remind_at","recurrence","status"])if(b[k]!==undefined){fields.push(k+" = $"+(values.length+1));values.push(b[k])}
 if(!fields.length)return res.status(400).json({error:"No changes supplied."});fields.push("updated_at = now()");values.push(req.member.id,id);
 const {rows}=await db.query("UPDATE reminders SET "+fields.join(", ")+" WHERE user_id = $"+(values.length-1)+" AND id = $"+values.length+" RETURNING id,title,message,remind_at,recurrence,status,updated_at",values);
 if(!rows.length)return res.status(404).json({error:"Reminder not found."});res.json(rows[0]);
}