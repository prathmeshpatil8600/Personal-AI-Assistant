import { db } from "hatchable";
import { generateText } from "../lib/ai-router.js";
import { createAssistantTools } from "../lib/assistant-tools.js";
import { requireFeature,requireUnits,entitlementError } from "../lib/entitlements.js";
import { deterministicChat,selectToolNames,filterTools,routeProfile,bumpOptimization } from "../lib/ai-optimization.js";
import { enforceUserRateLimit,rateLimitError } from "../lib/rate-limit.js";
import { markOnboardingStep } from "../lib/pilot.js";
import { buildContextPacket } from "../lib/context-optimizer.js";

export const access="user";
export const methods=["POST"];

async function maybeUpdateSummary(userId,conversationId,existingSummary,summarizedThrough){
 const count=await db.query("SELECT count(*)::int AS n FROM conversation_messages WHERE conversation_id=$1 AND user_id=$2",[conversationId,userId]);
 if((count.rows[0]?.n||0)<=14)return existingSummary||"";
 const recent=await db.query("SELECT created_at FROM conversation_messages WHERE conversation_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 8",[conversationId,userId]);
 const cutoff=recent.rows.length?recent.rows[recent.rows.length-1].created_at:null;
 if(!cutoff)return existingSummary||"";
 let sql="SELECT role,content,created_at FROM conversation_messages WHERE conversation_id=$1 AND user_id=$2 AND created_at < $3";
 const params=[conversationId,userId,cutoff];
 if(summarizedThrough){sql+=" AND created_at > $4";params.push(summarizedThrough)}
 sql+=" ORDER BY created_at ASC LIMIT 40";
 const older=await db.query(sql,params);
 if(!older.rows.length)return existingSummary||"";
 const transcript=older.rows.map(x=>x.role.toUpperCase()+": "+x.content).join("\n").slice(-12000);
 const summarized=await generateText({
  model:"google.gemini",purpose:"conversation_summary",userId,maxSteps:1,
  system:"Maintain a compact structured conversation state for future context. Preserve only durable information: current goal, decisions, constraints, unresolved tasks/questions, named entities, user preferences, important code/project state, and commitments. Drop greetings, repetition, obsolete details, and verbose prose. Never invent information. Return concise headings with bullets: Goal, Decisions, Constraints, Open items, Important context.",
  prompt:"Existing summary:\n"+(existingSummary||"None")+"\n\nNew older messages to incorporate:\n"+transcript
 });
 const through=older.rows[older.rows.length-1].created_at;
 await db.query("UPDATE conversations SET summary=$1,summarized_through_at=$2 WHERE id=$3 AND user_id=$4",[summarized.text||existingSummary||"",through,conversationId,userId]);
 await bumpOptimization(userId,{summary_updates:1});
 return summarized.text||existingSummary||"";
}

export default async function(req,res){
 const userId=req.user.id;
 const rate=await enforceUserRateLimit(userId,"chat",{limit:30,windowSeconds:60});if(!rate.ok)return rateLimitError(res,rate);
 const b=req.body||{},message=typeof b.message==="string"?b.message.trim():"";
 if(!message||message.length>12000)return res.status(400).json({error:"message is required (max 12,000 characters)."});
 const featureGate=await requireFeature(userId,"chat");if(!featureGate.ok)return entitlementError(res,featureGate);
 let conversationId=b.conversation_id,conversation={summary:"",summarized_through_at:null};
 if(conversationId){
  const c=await db.query("SELECT id,summary,summarized_through_at FROM conversations WHERE id=$1 AND user_id=$2",[conversationId,userId]);
  if(!c.rows.length)return res.status(404).json({error:"Conversation not found."});
  conversation=c.rows[0];
 }else{
  const title=message.length>60?message.slice(0,57)+"...":message;
  const c=await db.query("INSERT INTO conversations(user_id,title) VALUES($1,$2) RETURNING id,summary,summarized_through_at",[userId,title]);
  conversationId=c.rows[0].id;conversation=c.rows[0];
 }
 await db.query("INSERT INTO conversation_messages(conversation_id,user_id,role,content) VALUES($1,$2,'user',$3)",[conversationId,userId,message]);
 const deterministic=await deterministicChat(userId,message);
 if(deterministic){
  await db.query("INSERT INTO conversation_messages(conversation_id,user_id,role,content,tool_calls) VALUES($1,$2,'assistant',$3,'[]'::jsonb)",[conversationId,userId,deterministic.text]);
  await db.query("UPDATE conversations SET updated_at=now() WHERE id=$1 AND user_id=$2",[conversationId,userId]);
  await markOnboardingStep(userId,"chat");
  return res.json({conversation_id:conversationId,message:deterministic.text,steps:[],usage:{input:0,output:0,total_tokens:0},provider:"internal",model:"deterministic",optimized:true});
 }

 const summary=await maybeUpdateSummary(userId,conversationId,conversation.summary,conversation.summarized_through_at);
 const p=await db.query("SELECT preferred_language,response_style,timezone FROM user_preferences WHERE user_id=$1",[userId]);
 const pref=p.rows[0]||{preferred_language:"English",response_style:"concise",timezone:"UTC"};
 const toolNames=selectToolNames(message);
 const profile=routeProfile({purpose:"chat",message,hasTools:toolNames.length>0,responseStyle:pref.response_style});
 const unitMultiplier=profile.lane==="DEEP"?3:(profile.lane==="STANDARD"?2:1);
 const estimatedUnits=Math.max(1,Math.ceil(message.length/4000)*unitMultiplier);
 const unitGate=await requireUnits(userId,estimatedUnits);if(!unitGate.ok)return entitlementError(res,unitGate);
 const h=await db.query("SELECT role,content FROM conversation_messages WHERE conversation_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT $3",[conversationId,userId,Math.max(profile.maxRecentMessages,profile.maxRecentMessages*2)]);
 const memories=await db.query(`SELECT id,category,memory_key,memory_value,importance,confidence,
   ts_rank(to_tsvector('simple',coalesce(category,'')||' '||memory_key||' '||memory_value),plainto_tsquery('simple',$2)) AS relevance
   FROM memories WHERE user_id=$1
   ORDER BY (ts_rank(to_tsvector('simple',coalesce(category,'')||' '||memory_key||' '||memory_value),plainto_tsquery('simple',$2))*4 + importance/5.0 + confidence/5.0) DESC,updated_at DESC LIMIT $3`,[userId,message,profile.maxMemoryItems]);
 if(memories.rows.length){
  await db.query("UPDATE memories SET last_accessed_at=now(),access_count=access_count+1 WHERE user_id=$1 AND id = ANY($2::uuid[])",[userId,memories.rows.map(m=>m.id)]);
 }
 const pins=await db.query("SELECT id,label,content FROM conversation_context_pins WHERE user_id=$1 AND conversation_id=$2 ORDER BY created_at DESC LIMIT 8",[userId,conversationId]);
 const rawMessages=h.rows.reverse().map(x=>({role:x.role==="tool"?"assistant":x.role,content:x.content}));
 const packet=buildContextPacket({summary,memories:memories.rows,pins:pins.rows,messages:rawMessages,profile});
 const selectedTools=filterTools(createAssistantTools(userId,{conversationId}),toolNames);
 await bumpOptimization(userId,{
  memories_injected:memories.rows.length,
  tools_injected:Object.keys(selectedTools).length,
  messages_trimmed:Math.max(0,rawMessages.length-packet.messages.length),
  estimated_input_tokens_saved:packet.estimatedTokensSaved,
  context_budget_hits:packet.messages.length<rawMessages.length?1:0
 });

 const result=await generateText({
  model:"google.gemini",purpose:"chat",userId,maxSteps:profile.lane==="DEEP"?10:6,
  system:`You are SecondBrain, a practical personal AI assistant.
User preferences: language=${pref.preferred_language}; response style=${pref.response_style}; timezone=${pref.timezone}. Interpret relative dates and times in this timezone unless the user specifies another timezone.
Older conversation state:\n${packet.summary}
Relevant long-term memory:\n${packet.memories}
Pinned conversation context (preserve these details unless the user changes them):\n${packet.pins}
Use only the tools provided for this request when the answer depends on live workspace data. If no suitable tool is provided, do not invent live data. Perform write actions only when the user explicitly asks for them. Never claim an action was completed unless a tool actually completed it. Prefer the shortest complete answer; expand only when the user asks for detail or the task requires it.`,
  messages:packet.messages,
  tools:selectedTools,
  responseStyle:pref.response_style
 });

 await db.query("INSERT INTO conversation_messages(conversation_id,user_id,role,content,tool_calls) VALUES($1,$2,'assistant',$3,$4)",[conversationId,userId,result.text||"",JSON.stringify(result.steps||[])]);
 await db.query("UPDATE conversations SET updated_at=now() WHERE id=$1 AND user_id=$2",[conversationId,userId]);
 await markOnboardingStep(userId,"chat");
 res.json({
  conversation_id:conversationId,message:result.text,steps:result.steps,usage:result.usage,provider:result.provider,model:result.model,
  context:{mode:(summary||packet.estimatedTokensSaved>0)?"optimized":"full",lane:profile.lane,memories:memories.rows.length,pins:pins.rows.length,estimated_recent_tokens:packet.estimatedRecentTokens,estimated_tokens_saved:packet.estimatedTokensSaved}
 });
}