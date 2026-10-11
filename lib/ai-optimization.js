import { db } from "hatchable";
import { getUsageState } from "./entitlements.js";

export const CHEAP_MODEL="gemini-2.5-flash-lite";
export const STANDARD_MODEL="gemini-3.8-flash";

const CHEAP_PURPOSES=new Set([
 "conversation_summary","daily_briefing","weekly_briefing_job",
 "productivity_insights","weekly_review"
]);

function lower(v){return String(v||"").toLowerCase()}
export function routeProfile({purpose="",message="",hasTools=false,responseStyle="concise"}={}){
 const text=lower(message),p=lower(purpose);
 const explicitDeep=/\b(deep|detailed|comprehensive|research|analy[sz]e deeply|step[- ]by[- ]step|architecture|debug|complex)\b/.test(text);
 const coding=/\b(code|bug|error|stack trace|sql|api|algorithm|implement|refactor)\b/.test(text);
 const cheap=CHEAP_PURPOSES.has(p)||(!hasTools&&!explicitDeep&&!coding&&text.length<1800);
 const model=cheap?CHEAP_MODEL:STANDARD_MODEL;
 const maxRecentMessages=explicitDeep?8:6;
 const maxMemoryItems=explicitDeep?5:3;
 const maxMessageChars=explicitDeep?18000:10000;
 const outputHint=responseStyle==="detailed"?(explicitDeep?"up to 1400 words":"up to 900 words"):(responseStyle==="balanced"?"usually under 600 words":"usually under 350 words");
 return {lane:cheap?"CHEAP":"STANDARD",model,maxRecentMessages,maxMemoryItems,maxMessageChars,outputHint};
}

export function selectToolNames(message){
 const t=lower(message);
 const names=new Set();
 if(/\b(task|todo|to-do|priority|priorities)\b/.test(t)){names.add("list_tasks");if(/\b(add|create|make|new)\b/.test(t))names.add("create_task")}
 if(/\b(remind|reminder)\b/.test(t))names.add("create_reminder");
 if(/\b(calendar|meeting|event|schedule|appointment)\b/.test(t))names.add("list_calendar");
 if(/\b(note|notes)\b/.test(t))names.add("list_notes");
 if(/\b(remember|memory|memories|what do you know about me)\b/.test(t)){names.add("list_memory");if(/\bremember|save this|store this\b/.test(t))names.add("save_memory")}
 if(/\b(email|gmail|inbox|mail)\b/.test(t)){names.add("google_search_gmail");if(/\b(send|email .* to|mail .* to)\b/.test(t))names.add("google_send_gmail")}
 if(/\b(google calendar)\b/.test(t)){names.add("google_list_calendar");if(/\b(create|add|schedule)\b/.test(t))names.add("google_create_calendar_event")}
 if(/\b(drive|google drive|file metadata)\b/.test(t))names.add("google_search_drive");
 if(/\b(github|repository|repo|pull request|issue)\b/.test(t)){
  names.add("github_list_repositories");names.add("github_list_issues");
  if(/\b(file|content|source)\b/.test(t))names.add("github_get_repository_content");
  if(/\b(create .*issue|open .*issue)\b/.test(t))names.add("github_create_issue");
  if(/\b(comment|reply)\b/.test(t))names.add("github_add_issue_comment");
 }
 if(/\b(search|find|look for|where is|across my|workspace)\b/.test(t))names.add("search_workspace");
 return [...names];
}

export function filterTools(tools,names){
 if(!tools||!names?.length)return {};
 const wanted=new Set(names);
 return Object.fromEntries(Object.entries(tools).filter(([k])=>wanted.has(k)));
}

export function budgetMessages(messages,maxMessages=6,maxChars=10000){
 const src=Array.isArray(messages)?messages:[];
 const selected=src.slice(-Math.max(1,maxMessages));
 let used=0,out=[];
 for(let i=selected.length-1;i>=0;i--){
  const m=selected[i],content=String(m?.content||"");
  const room=maxChars-used;if(room<=0)break;
  const clipped=content.length>room?content.slice(content.length-room):content;
  out.unshift({...m,content:clipped});used+=clipped.length;
 }
 return {messages:out,trimmed:Math.max(0,src.length-out.length),chars:used};
}

async function sha(text){
 const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
 return Array.from(new Uint8Array(d),b=>b.toString(16).padStart(2,"0")).join("");
}
export async function makeCacheKey({purpose,model,system,messages}){
 return sha(JSON.stringify({purpose,model,system,messages}));
}
export async function readAiCache(userId,cacheKey){
 const row=(await db.query("SELECT id,response_json FROM ai_response_cache WHERE user_id=$1 AND cache_key=$2 AND expires_at>now() LIMIT 1",[userId,cacheKey])).rows[0];
 if(!row)return null;
 await db.query("UPDATE ai_response_cache SET hit_count=hit_count+1,last_hit_at=now() WHERE id=$1",[row.id]);
 await bumpOptimization(userId,{cache_hits:1});
 return row.response_json;
}
export async function writeAiCache({userId,cacheKey,purpose,model,response,ttlSeconds=900}){
 if(!userId||!cacheKey)return;
 const ttl=Math.max(30,Math.min(86400,Number(ttlSeconds)||900));
 await db.query(`
  INSERT INTO ai_response_cache(user_id,cache_key,purpose,model,response_json,expires_at)
  VALUES($1,$2,$3,$4,$5::jsonb,now()+($6::int*interval '1 second'))
  ON CONFLICT(user_id,cache_key) DO UPDATE SET response_json=EXCLUDED.response_json,expires_at=EXCLUDED.expires_at,created_at=now(),last_hit_at=NULL,hit_count=0
 `,[userId,cacheKey,purpose,model,JSON.stringify(response),ttl]);
}
export async function bumpOptimization(userId,delta={}){
 if(!userId)return;
 const fields=["deterministic_responses","cache_hits","cheap_model_runs","standard_model_runs","messages_trimmed","memories_injected","tools_injected"];
 const vals=fields.map(k=>Math.max(0,Math.floor(Number(delta[k])||0)));
 await db.query(`
  INSERT INTO ai_optimization_daily(user_id,metric_date,deterministic_responses,cache_hits,cheap_model_runs,standard_model_runs,messages_trimmed,memories_injected,tools_injected)
  VALUES($1,CURRENT_DATE,$2,$3,$4,$5,$6,$7,$8)
  ON CONFLICT(user_id,metric_date) DO UPDATE SET
   deterministic_responses=ai_optimization_daily.deterministic_responses+EXCLUDED.deterministic_responses,
   cache_hits=ai_optimization_daily.cache_hits+EXCLUDED.cache_hits,
   cheap_model_runs=ai_optimization_daily.cheap_model_runs+EXCLUDED.cheap_model_runs,
   standard_model_runs=ai_optimization_daily.standard_model_runs+EXCLUDED.standard_model_runs,
   messages_trimmed=ai_optimization_daily.messages_trimmed+EXCLUDED.messages_trimmed,
   memories_injected=ai_optimization_daily.memories_injected+EXCLUDED.memories_injected,
   tools_injected=ai_optimization_daily.tools_injected+EXCLUDED.tools_injected,
   updated_at=now()
 `,[userId,...vals]);
}

export async function deterministicChat(userId,message){
 const t=lower(message).trim();
 if(/\b(remaining|left|usage|allowance|credits|quota)\b/.test(t)&&/\b(ai|monthly|plan|account|usage|credits|quota)\b/.test(t)){
  const s=await getUsageState(userId);
  const text="You have "+s.remaining_units.toLocaleString("en-IN")+" of "+s.allowance_units.toLocaleString("en-IN")+" monthly AI credits remaining on "+s.plan.display_name+". You have used "+s.used_units.toLocaleString("en-IN")+" credits this period.";
  await bumpOptimization(userId,{deterministic_responses:1});return {text,kind:"allowance"};
 }
 if(/^(show|list|what are|what's|whats)\s+(my\s+)?(open\s+)?(tasks|to-?dos)(\s+today)?[?.!]*$/.test(t)){
  const rows=(await db.query("SELECT title,priority,status,due_at FROM tasks WHERE user_id=$1 AND status NOT IN ('COMPLETED','CANCELLED') ORDER BY due_at NULLS LAST,priority DESC LIMIT 20",[userId])).rows;
  const text=rows.length?"Your open tasks:\n"+rows.map((x,i)=>(i+1)+". "+x.title+" ["+x.priority+"]"+(x.due_at?" — due "+new Date(x.due_at).toLocaleString():"")).join("\n"):"You have no open tasks.";
  await bumpOptimization(userId,{deterministic_responses:1});return {text,kind:"tasks"};
 }
 if(/^(show|list|what are|what's|whats)\s+(my\s+)?(reminders)[?.!]*$/.test(t)){
  const rows=(await db.query("SELECT title,remind_at FROM reminders WHERE user_id=$1 AND status='SCHEDULED' ORDER BY remind_at LIMIT 20",[userId])).rows;
  const text=rows.length?"Your scheduled reminders:\n"+rows.map((x,i)=>(i+1)+". "+x.title+" — "+new Date(x.remind_at).toLocaleString()).join("\n"):"You have no scheduled reminders.";
  await bumpOptimization(userId,{deterministic_responses:1});return {text,kind:"reminders"};
 }
 if(/^(show|list|what are|what's|whats)\s+(my\s+)?(notes)[?.!]*$/.test(t)){
  const rows=(await db.query("SELECT title,updated_at FROM notes WHERE user_id=$1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 20",[userId])).rows;
  const text=rows.length?"Your recent notes:\n"+rows.map((x,i)=>(i+1)+". "+x.title).join("\n"):"You have no saved notes.";
  await bumpOptimization(userId,{deterministic_responses:1});return {text,kind:"notes"};
 }
 return null;
}