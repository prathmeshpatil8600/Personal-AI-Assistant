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
 const messages=h.rows.reverse().map(x=>({role:x.role==="tool"?"assistant":x.role,content:x.content}));
 const result=await ai.generateText({
  model:"sonnet",purpose:"chat",userId,maxSteps:6,
  system:"You are SecondBrain, a practical personal AI assistant. Be concise, accurate, and action-oriented. Help organize tasks, notes, reminders, planning, learning, coding, and general questions. Never claim an action was completed unless a tool actually completed it.",
  messages,
  tools:{
   list_tasks:{description:"List the signed-in user's tasks.",inputSchema:{type:"object",properties:{status:{type:"string",enum:["TODO","IN_PROGRESS","COMPLETED","CANCELLED"]}},required:[]},execute:async({status})=>{const q=status?"SELECT id,title,priority,status,due_at FROM tasks WHERE user_id=$1 AND status=$2 ORDER BY due_at NULLS LAST LIMIT 20":"SELECT id,title,priority,status,due_at FROM tasks WHERE user_id=$1 AND status<>'CANCELLED' ORDER BY due_at NULLS LAST LIMIT 20";return {tasks:(await db.query(q,status?[userId,status]:[userId])).rows};}},
   create_task:{description:"Create a task when the user explicitly asks to create one.",inputSchema:{type:"object",properties:{title:{type:"string"},description:{type:"string"},priority:{type:"string",enum:["LOW","MEDIUM","HIGH","URGENT"]},due_at:{type:"string"}},required:["title"]},execute:async({title,description="",priority="MEDIUM",due_at=null})=>{if(!title?.trim())return {error:"A task title is required."};const r=await db.query("INSERT INTO tasks(user_id,title,description,priority,due_at) VALUES($1,$2,$3,$4,$5) RETURNING id,title,priority,status,due_at",[userId,title.trim(),description,priority,due_at?new Date(due_at):null]);return {created:r.rows[0]};}},
   list_notes:{description:"Search or list the signed-in user's notes.",inputSchema:{type:"object",properties:{query:{type:"string"}},required:[]},execute:async({query=""})=>{const r=await db.query("SELECT id,title,content,category,pinned,updated_at FROM notes WHERE user_id=$1 AND deleted_at IS NULL AND (title ILIKE $2 OR content ILIKE $2) ORDER BY pinned DESC,updated_at DESC LIMIT 20",[userId,"%"+query+"%"]);return {notes:r.rows};}},
   create_reminder:{description:"Create a reminder only when the user explicitly asks to be reminded at a specific time.",inputSchema:{type:"object",properties:{title:{type:"string"},remind_at:{type:"string"},message:{type:"string"},recurrence:{type:"string"}},required:["title","remind_at"]},execute:async({title,remind_at,message="",recurrence=null})=>{const at=new Date(remind_at);if(Number.isNaN(at.getTime()))return {error:"Invalid reminder time."};const r=await db.query("INSERT INTO reminders(user_id,title,message,remind_at,recurrence) VALUES($1,$2,$3,$4,$5) RETURNING id,title,remind_at,recurrence,status",[userId,title,message,at,recurrence]);return {created:r.rows[0]};}}
  }
 });
 await db.query("INSERT INTO conversation_messages(conversation_id,user_id,role,content,tool_calls) VALUES($1,$2,'assistant',$3,$4)",[conversationId,userId,result.text||"",JSON.stringify(result.steps||[])]);
 await db.query("UPDATE conversations SET updated_at=now() WHERE id=$1 AND user_id=$2",[conversationId,userId]);
 res.json({conversation_id:conversationId,message:result.text,steps:result.steps,usage:result.usage});
}