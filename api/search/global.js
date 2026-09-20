import { db } from "hatchable";

export const access = "member";
export const methods = ["GET"];

export default async function(req,res){
  const q=String(req.query?.q||"").trim();
  if(!q) return res.json({query:"",results:[]});
  const like="%"+q+"%";
  const {rows}=await db.query(`
    SELECT * FROM (
      SELECT 'task' AS type,id,title,description AS snippet,updated_at AS date FROM tasks
      WHERE title ILIKE $1 OR description ILIKE $1
      UNION ALL
      SELECT 'note',id,title,content,updated_at FROM notes
      WHERE title ILIKE $1 OR content ILIKE $1
      UNION ALL
      SELECT 'reminder',id,title,message,updated_at FROM reminders
      WHERE title ILIKE $1 OR message ILIKE $1
      UNION ALL
      SELECT 'event',id,title,description,start_at FROM calendar_events
      WHERE title ILIKE $1 OR description ILIKE $1 OR location ILIKE $1
      UNION ALL
      SELECT 'conversation',id,title,content,created_at FROM conversation_messages cm
      JOIN conversations c ON c.id=cm.conversation_id
      WHERE cm.content ILIKE $1
      UNION ALL
      SELECT 'document',d.id,d.title,dc.content,dc.created_at
      FROM documents d JOIN document_chunks dc ON dc.document_id=d.id
      WHERE d.title ILIKE $1 OR d.filename ILIKE $1 OR dc.content ILIKE $1
      UNION ALL
      SELECT 'memory',id,memory_key,memory_value,updated_at FROM memories
      WHERE memory_key ILIKE $1 OR memory_value ILIKE $1 OR category ILIKE $1
    ) s
    ORDER BY date DESC NULLS LAST
    LIMIT 40
  `,[like]);
  res.json({query:q,results:rows});
}