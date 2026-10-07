import { db } from "hatchable";
export const access="member";
export const methods=["POST"];
export default async function(req,res){
 const b=req.body||{},id=String(b.id||"").trim();
 if(!id)return res.status(400).json({error:"id is required"});
 const category=String(b.category||"general").trim().slice(0,80)||"general";
 const key=String(b.memory_key||"").trim();
 const value=String(b.memory_value||"").trim();
 const importance=Math.max(1,Math.min(5,Number.parseInt(b.importance,10)||3));
 if(!key||!value)return res.status(400).json({error:"memory_key and memory_value are required"});
 const r=await db.query("UPDATE memories SET category=$1,memory_key=$2,memory_value=$3,importance=$4,source='user',confidence=1,updated_at=now() WHERE id=$5 AND user_id=$6 RETURNING id,category,memory_key,memory_value,source,importance,confidence,last_accessed_at,access_count,created_at,updated_at",[category,key,value,importance,id,req.member.id]);
 if(!r.rows.length)return res.status(404).json({error:"Memory not found"});
 res.json(r.rows[0]);
}