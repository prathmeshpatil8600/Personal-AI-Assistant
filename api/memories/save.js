import { db } from "hatchable";
export const access="member";
export const methods=["POST"];
export default async function(req,res){
  const b=req.body||{};
  const key=String(b.memory_key||"").trim();
  const value=String(b.memory_value||"").trim();
  if(!key||!value) return res.status(400).json({error:"memory_key and memory_value are required"});
  const category=String(b.category||"general").trim().slice(0,80)||"general";
  const source=String(b.source||"user").trim().slice(0,80)||"user";
  const importance=Math.max(1,Math.min(5,Number.parseInt(b.importance,10)||3));
  const {rows}=await db.query(`
    INSERT INTO memories(user_id,category,memory_key,memory_value,source,importance)
    VALUES($1,$2,$3,$4,$5,$6)
    ON CONFLICT(user_id,memory_key) DO UPDATE SET category=EXCLUDED.category,memory_value=EXCLUDED.memory_value,source=EXCLUDED.source,importance=EXCLUDED.importance,updated_at=now()
    RETURNING id,category,memory_key,memory_value,source,importance,created_at,updated_at
  `,[req.member.id,category,key,value,source,importance]);
  res.json(rows[0]);
}