import { db } from "hatchable";
export const access="user";
export const methods=["GET"];
export default async function(req,res){
 const q=String(req.query?.q||"").trim();
 if(!q)return res.json({query:"",results:[]});
 const like="%"+q+"%",uid=req.user.id;
 const {rows}=await db.query(`
 SELECT * FROM (
  SELECT 'task' type,id,title,description snippet,updated_at date FROM tasks WHERE user_id=$1 AND (title ILIKE $2 OR description ILIKE $2)
  UNION ALL SELECT 'note',id,title,content,updated_at FROM notes WHERE user_id=$1 AND deleted_at IS NULL AND (title ILIKE $2 OR content ILIKE $2)
  UNION ALL SELECT 'reminder',id,title,message,updated_at FROM reminders WHERE user_id=$1 AND (title ILIKE $2 OR message ILIKE $2)
  UNION ALL SELECT 'event',id,title,description,start_at FROM calendar_events WHERE user_id=$1 AND (title ILIKE $2 OR description ILIKE $2 OR location ILIKE $2)
  UNION ALL SELECT 'conversation',cm.id,c.title,cm.content,cm.created_at FROM conversation_messages cm JOIN conversations c ON c.id=cm.conversation_id WHERE cm.user_id=$1 AND c.user_id=$1 AND cm.content ILIKE $2
  UNION ALL SELECT 'document',d.id,d.title,dc.content,dc.created_at FROM documents d JOIN document_chunks dc ON dc.document_id=d.id WHERE d.user_id=$1 AND dc.user_id=$1 AND (d.title ILIKE $2 OR d.filename ILIKE $2 OR dc.content ILIKE $2)
  UNION ALL SELECT 'memory',id,memory_key,memory_value,updated_at FROM memories WHERE user_id=$1 AND (memory_key ILIKE $2 OR memory_value ILIKE $2 OR category ILIKE $2)
 ) s ORDER BY date DESC NULLS LAST LIMIT 40`,[uid,like]);
 res.json({query:q,results:rows});
}