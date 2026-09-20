import { db } from "hatchable";
export const access="member"; export const methods=["PATCH"];
export default async function(req,res){
 const id=req.query?.id||req.params?.id;if(!id)return res.status(400).json({error:"Event id is required."});
 const b=req.body||{},fields=[],values=[];
 for(const k of ["title","description","start_at","end_at","all_day","location","recurrence","reminder_minutes","status"])if(b[k]!==undefined){fields.push(k+" = $"+(values.length+1));values.push(b[k])}
 if(!fields.length)return res.status(400).json({error:"No changes supplied."});
 fields.push("updated_at=now()");values.push(req.member.id,id);
 const r=await db.query("UPDATE calendar_events SET "+fields.join(", ")+" WHERE user_id=$"+(values.length-1)+" AND id=$"+values.length+" RETURNING *",values);
 if(!r.rows.length)return res.status(404).json({error:"Event not found."});res.json(r.rows[0]);
}