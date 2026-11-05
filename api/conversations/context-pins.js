import { db } from "hatchable";
export const access="user";
export const methods=["GET","POST","DELETE"];

async function ownsConversation(userId,conversationId){
 const r=await db.query("SELECT 1 FROM conversations WHERE id=$1 AND user_id=$2",[conversationId,userId]);
 return r.rows.length>0;
}

export default async function(req,res){
 const uid=req.user.id;
 const conversationId=String(req.query?.conversation_id||req.body?.conversation_id||"").trim();
 if(!conversationId||!(await ownsConversation(uid,conversationId)))return res.status(404).json({error:"conversation_not_found"});
 if(req.method==="GET"){
  const rows=(await db.query("SELECT id,label,content,created_at FROM conversation_context_pins WHERE user_id=$1 AND conversation_id=$2 ORDER BY created_at DESC",[uid,conversationId])).rows;
  return res.json(rows);
 }
 if(req.method==="DELETE"){
  const id=String(req.query?.id||req.body?.id||"").trim();
  const row=(await db.query("DELETE FROM conversation_context_pins WHERE id=$1 AND user_id=$2 AND conversation_id=$3 RETURNING id",[id,uid,conversationId])).rows[0];
  if(!row)return res.status(404).json({error:"pin_not_found"});
  return res.json({ok:true,id});
 }
 const content=String(req.body?.content||"").trim().slice(0,6000);
 const label=String(req.body?.label||"Pinned chat context").trim().slice(0,120);
 if(!content)return res.status(400).json({error:"content is required"});
 const existing=(await db.query("SELECT id FROM conversation_context_pins WHERE user_id=$1 AND conversation_id=$2 AND content=$3 LIMIT 1",[uid,conversationId,content])).rows[0];
 if(existing)return res.json({ok:true,id:existing.id,already_pinned:true});
 const row=(await db.query("INSERT INTO conversation_context_pins(user_id,conversation_id,label,content) VALUES($1,$2,$3,$4) RETURNING id,label,content,created_at",[uid,conversationId,label,content])).rows[0];
 res.status(201).json(row);
}