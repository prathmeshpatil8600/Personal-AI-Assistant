import { ai, db } from "hatchable";
export const access="member";
export const methods=["POST"];

export default async function(req,res){
 const userId=req.member.id, b=req.body||{}, message=typeof b.message==="string"?b.message.trim():"";
 if(!message||message.length>12000)return res.status(400).json({error:"message is required (max 12,000 characters)."});
 let conversationId=b.conversation_id;
 if(conversationId){
  const c=await db.query("SELECT id FROM conversations WHERE id=$1 AND user_id=$2",[conversationId,userId]);
  if(!c.rows.length)return res.status(404).json({error:"Conversation not found."});
 }else{
  const title=message.length>60?message.slice(0,57)+"...":message;
  const c=await db.query("INSERT INTO conversations(user_id,title) VALUES($1,$2) RETURNING id",[userId,title]);
  conversationId=c.rows[0].id;
 }
 await db.query("INSERT INTO conversation_messages(conversation_id,user_id,role,content) VALUES($1,$2,'user',$3)",[conversationId,userId,message]);
 const h=await db.query("SELECT role,content FROM conversation_messages WHERE conversation_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 30",[conversationId,userId]);
 const p=await db.query("SELECT preferred_language,response_style FROM user_preferences WHERE user_id=$1",[userId]);
 const pref=p.rows[0]||{preferred_language:"English",response_style:"concise"};
 const memories=await db.query("SELECT category,memory_key,memory_value,importance FROM memories WHERE user_id=$1 ORDER BY importance DESC,updated_at DESC LIMIT 20",[userId]);
 const memoryContext=memories.rows.length?memories.rows.map(m=>"- "+m.memory_key+": "+m.memory_value).join("\n"):"No saved memories.";
 const messages=h.rows.reverse().map(x=>({role:x.role==="tool"?"assistant":x.role,content:x.content}));
 const result=await ai.generateText({
  model:"sonnet",purpose:"chat",userId,maxSteps:10,
  system:`You are SecondBrain, a practical personal AI assistant.
User preferences: language=${pref.preferred_language}; response style=${pref.response_style}.
Known long-term memory:
${memoryContext}
Use the workspace tools when the answer depends on the user's live data. Use memory tools when the user asks what you remember or explicitly asks you to remember something. Use search_workspace for broad cross-module retrieval. Use create_task/create_reminder only when the user explicitly asks for an action. Never claim an action was completed unless a tool actually completed it. Keep responses concise unless the user preference requests detail.`,
  messages,
  tools:{
   search_workspace:{description:"Search the user's tasks, notes, reminders, calendar events, conversations, documents and memories by keyword.",inputSchema:{type:"object",properties:{query:{type:"string"}},required:["query"]},execute:async({query})=>{const like="%"+String(query||"").trim()+"%";if(like==="%%")return {results:[]};const r=await db.query(`SELECT * FROM (
SELECT 'task' type,id,title,description snippet,updated_at date FROM tasks WHERE user_id=$1 AND (title ILIKE $2 OR description ILIKE $2)
UNION ALL SELECT 'note',id,title,content,updated_at FROM notes WHERE user_id=$1 AND deleted_at IS NULL AND (title ILIKE $2 OR content ILIKE $2)
UNION ALL SELECT 'reminder',id,title,message,updated_at FROM reminders WHERE user_id=$1 AND (title ILIKE $2 OR message ILIKE $2)
UNION ALL SELECT 'event',id,title,description,start_at FROM calendar_events WHERE user_id=$1 AND (title ILIKE $2 OR description ILIKE $2 OR location ILIKE $2)
UNION ALL SELECT 'conversation',cm.id,c.title,cm.content,cm.created_at FROM conversation_messages cm JOIN conversations c ON c.id=cm.conversation_id WHERE cm.user_id=$1 AND cm.content ILIKE $2
UNION ALL SELECT 'document',d.id,d.title,dc.content,dc.created_at FROM documents d JOIN document_chunks dc ON dc.document_id=d.id WHERE d.user_id=$1 AND (d.title ILIKE $2 OR d.filename ILIKE $2 OR dc.content ILIKE $2)
UNION ALL SELECT 'memory',id,memory_key,memory_value,updated_at FROM memories WHERE user_id=$1 AND (memory_key ILIKE $2 OR memory_value ILIKE $2 OR category ILIKE $2)
) s ORDER BY date DESC NULLS LAST LIMIT 30`,[userId,like]);return {results:r.rows};}},
   list_memory:{description:"List the user's saved long-term memories.",inputSchema:{type:"object",properties:{category:{type:"string"}},required:[]},execute:async({category})=>{const r=await db.query(category?"SELECT category,memory_key,memory_value,importance FROM memories WHERE user_id=$1 AND category=$2 ORDER BY importance DESC,updated_at DESC":"SELECT category,memory_key,memory_value,importance FROM memories WHERE user_id=$1 ORDER BY importance DESC,updated_at DESC",[userId,...(category?[category]:[])]);return {memories:r.rows};}},
   save_memory:{description:"Save or update a durable user preference or fact only when the user explicitly asks you to remember it.",inputSchema:{type:"object",properties:{memory_key:{type:"string"},memory_value:{type:"string"},category:{type:"string"},importance:{type:"integer"}},required:["memory_key","memory_value"]},execute:async({memory_key,memory_value,category="general",importance=3})=>{const r=await db.query(`INSERT INTO memories(user_id,category,memory_key,memory_value,source,importance) VALUES($1,$2,$3,$4,'assistant',LEAST(5,GREATEST(1,$5))) ON CONFLICT(user_id,memory_key) DO UPDATE SET category=EXCLUDED.category,memory_value=EXCLUDED.memory_value,source='assistant',importance=EXCLUDED.importance,updated_at=now() RETURNING id,memory_key,memory_value,category,importance`,[userId,String(category).slice(0,80),String(memory_key).trim(),String(memory_value).trim(),Number(importance)||3]);return {saved:r.rows[0]};}},
   list_calendar:{description:"List the user's calendar events in a date range. Use ISO timestamps.",inputSchema:{type:"object",properties:{from:{type:"string"},to:{type:"string"}},required:["from","to"]},execute:async({from,to})=>{const r=await db.query("SELECT id,title,description,start_at,end_at,all_day,location,status FROM calendar_events WHERE user_id=$1 AND start_at >= $2 AND start_at < $3 ORDER BY start_at LIMIT 50",[userId,new Date(from),new Date(to)]);return {events:r.rows};}},
   list_tasks:{description:"List the signed-in user's tasks.",inputSchema:{type:"object",properties:{status:{type:"string",enum:["TODO","IN_PROGRESS","COMPLETED","CANCELLED"]}},required:[]},execute:async({status})=>{const q=status?"SELECT id,title,priority,status,due_at FROM tasks WHERE user_id=$1 AND status=$2 ORDER BY due_at NULLS LAST LIMIT 20":"SELECT id,title,priority,status,due_at FROM tasks WHERE user_id=$1 AND status<>'CANCELLED' ORDER BY due_at NULLS LAST LIMIT 20";return {tasks:(await db.query(q,status?[userId,status]:[userId])).rows};}},
   create_task:{description:"Create a task when the user explicitly asks for one.",inputSchema:{type:"object",properties:{title:{type:"string"},description:{type:"string"},priority:{type:"string",enum:["LOW","MEDIUM","HIGH","URGENT"]},due_at:{type:"string"}},required:["title"]},execute:async({title,description="",priority="MEDIUM",due_at=null})=>{const r=await db.query("INSERT INTO tasks(user_id,title,description,priority,due_at) VALUES($1,$2,$3,$4,$5) RETURNING id,title,priority,status,due_at",[userId,title.trim(),description,priority,due_at?new Date(due_at):null]);return {created:r.rows[0]};}},
   list_notes:{description:"Search the user's notes.",inputSchema:{type:"object",properties:{query:{type:"string"}},required:[]},execute:async({query=""})=>{const r=await db.query("SELECT id,title,content,category,pinned,updated_at FROM notes WHERE user_id=$1 AND deleted_at IS NULL AND (title ILIKE $2 OR content ILIKE $2) ORDER BY pinned DESC,updated_at DESC LIMIT 20",[userId,"%"+query+"%"]);return {notes:r.rows};}},
   create_reminder:{description:"Create a reminder when the user explicitly asks for one at a specific time.",inputSchema:{type:"object",properties:{title:{type:"string"},remind_at:{type:"string"},message:{type:"string"},recurrence:{type:"string"}},required:["title","remind_at"]},execute:async({title,remind_at,message="",recurrence=null})=>{const at=new Date(remind_at);if(Number.isNaN(at.getTime()))return {error:"Invalid reminder time."};const r=await db.query("INSERT INTO reminders(user_id,title,message,remind_at,recurrence) VALUES($1,$2,$3,$4,$5) RETURNING id,title,remind_at,recurrence,status",[userId,title,message,at,recurrence]);return {created:r.rows[0]};}}
  }
 });
 await db.query("INSERT INTO conversation_messages(conversation_id,user_id,role,content,tool_calls) VALUES($1,$2,'assistant',$3,$4)",[conversationId,userId,result.text||"",JSON.stringify(result.steps||[])]);
 await db.query("UPDATE conversations SET updated_at=now() WHERE id=$1 AND user_id=$2",[conversationId,userId]);
 res.json({conversation_id:conversationId,message:result.text,steps:result.steps,usage:result.usage});
}