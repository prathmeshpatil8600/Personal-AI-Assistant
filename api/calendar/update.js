import { db } from "hatchable";
import { normalizeRecurrence } from "../../lib/recurrence.js";
export const access="user"; export const methods=["PATCH"];
export default async function(req,res){
 const id=req.query?.id||req.params?.id;
 if(!id)return res.status(400).json({error:"Event id is required."});
 const b=req.body||{},fields=[],values=[];
 for(const k of ["title","description","start_at","end_at","all_day","location","recurrence","reminder_minutes","status"])if(b[k]!==undefined){
  if((k==="start_at"||k==="end_at")&&b[k]!==null){
   const dt=new Date(b[k]);if(Number.isNaN(dt.getTime()))return res.status(400).json({error:"Invalid event time."});
   values.push(dt);
  }else if(k==="recurrence"){
   try{values.push(normalizeRecurrence(b[k]))}catch(e){return res.status(400).json({error:e.message})}
  }else values.push(b[k]);
  fields.push(k+" = $"+values.length);
 }
 if(!fields.length)return res.status(400).json({error:"No changes supplied."});
 const startValue=fields.findIndex(x=>x.startsWith("start_at = "));
 const endValue=fields.findIndex(x=>x.startsWith("end_at = "));
 if(startValue>=0&&endValue>=0&&values[startValue]>values[endValue])return res.status(400).json({error:"End time must be after start time."});
 fields.push("updated_at=now()");values.push(req.user.id,id);
 const r=await db.query("UPDATE calendar_events SET "+fields.join(", ")+" WHERE user_id=$"+(values.length-1)+" AND id=$"+values.length+" RETURNING *",values);
 if(!r.rows.length)return res.status(404).json({error:"Event not found."});
 res.json(r.rows[0]);
}