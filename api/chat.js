import { db } from "hatchable";
import { generateText } from "../lib/ai-router.js";
import { createAssistantTools } from "../lib/assistant-tools.js";

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
 const p=await db.query("SELECT preferred_language,response_style,timezone FROM user_preferences WHERE user_id=$1",[userId]);
 const pref=p.rows[0]||{preferred_language:"English",response_style:"concise",timezone:"UTC"};
 const memories=await db.query("SELECT category,memory_key,memory_value,importance FROM memories WHERE user_id=$1 ORDER BY importance DESC,updated_at DESC LIMIT 20",[userId]);
 const memoryContext=memories.rows.length?memories.rows.map(m=>"- "+m.memory_key+": "+m.memory_value).join("\n"):"No saved memories.";
 const messages=h.rows.reverse().map(x=>({role:x.role==="tool"?"assistant":x.role,content:x.content}));

 const result=await generateText({
  model:"google.gemini",
  purpose:"chat",
  userId,
  maxSteps:10,
  system:`You are SecondBrain, a practical personal AI assistant.
User preferences: language=${pref.preferred_language}; response style=${pref.response_style}; timezone=${pref.timezone}. Interpret relative dates and times in this timezone unless the user specifies another timezone.
Known long-term memory:
${memoryContext}
Use workspace tools when the answer depends on live data. Use memory tools when the user asks what you remember or explicitly asks you to remember something. Use search_workspace for broad cross-module retrieval. Use create_task/create_reminder only when the user explicitly asks for an action. Never claim an action was completed unless a tool actually completed it. Keep responses concise unless the user preference requests detail.`,
  messages,
  tools:createAssistantTools(userId)
 });

 await db.query("INSERT INTO conversation_messages(conversation_id,user_id,role,content,tool_calls) VALUES($1,$2,'assistant',$3,$4)",[conversationId,userId,result.text||"",JSON.stringify(result.steps||[])]);
 await db.query("UPDATE conversations SET updated_at=now() WHERE id=$1 AND user_id=$2",[conversationId,userId]);
 res.json({conversation_id:conversationId,message:result.text,steps:result.steps,usage:result.usage,provider:result.provider,model:result.model});
}