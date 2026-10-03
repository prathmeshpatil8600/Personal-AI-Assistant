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
  const confidence=Math.max(0,Math.min(1,Number(b.confidence ?? (source==="user"?1:0.85))));
  const sourceConversationId=b.source_conversation_id||null;
  const {rows}=await db.query(`
    INSERT INTO memories(user_id,category,memory_key,memory_value,source,importance,confidence,source_conversation_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT(user_id,memory_key) DO UPDATE SET category=EXCLUDED.category,memory_value=EXCLUDED.memory_value,source=EXCLUDED.source,importance=EXCLUDED.importance,confidence=EXCLUDED.confidence,source_conversation_id=COALESCE(EXCLUDED.source_conversation_id,memories.source_conversation_id),updated_at=now()
    RETURNING id,category,memory_key,memory_value,source,importance,confidence,source_conversation_id,created_at,updated_at
  `,[req.member.id,category,key,value,source,importance,confidence,sourceConversationId]);
  res.json(rows[0]);
}