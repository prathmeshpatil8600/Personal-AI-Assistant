import { db } from "hatchable";
export const access="user";
export const methods=["GET"];

async function rows(sql,params){return (await db.query(sql,params)).rows}

export default async function(req,res){
 const uid=req.user.id;
 const [
  preferences,conversations,messages,tasks,notes,reminders,calendar,memories,documents,chunks,
  goals,habits,habitCompletions,notifications,google,github,plans,billing,addons,organizations,
  toolRuns,aiRuns
 ]=await Promise.all([
  rows("SELECT preferred_language,response_style,theme,timezone,created_at,updated_at FROM user_preferences WHERE user_id=$1",[uid]),
  rows("SELECT id,title,summary,created_at,updated_at FROM conversations WHERE user_id=$1 ORDER BY created_at",[uid]),
  rows("SELECT id,conversation_id,role,content,tool_calls,tool_results,created_at FROM conversation_messages WHERE user_id=$1 ORDER BY created_at LIMIT 10000",[uid]),
  rows("SELECT * FROM tasks WHERE user_id=$1 ORDER BY created_at",[uid]),
  rows("SELECT * FROM notes WHERE user_id=$1 ORDER BY created_at",[uid]),
  rows("SELECT * FROM reminders WHERE user_id=$1 ORDER BY created_at",[uid]),
  rows("SELECT * FROM calendar_events WHERE user_id=$1 ORDER BY start_at",[uid]),
  rows("SELECT * FROM memories WHERE user_id=$1 ORDER BY created_at",[uid]),
  rows("SELECT id,title,filename,content_type,status,error_message,created_at,updated_at FROM documents WHERE user_id=$1 ORDER BY created_at",[uid]),
  rows("SELECT document_id,chunk_index,content,created_at FROM document_chunks WHERE user_id=$1 ORDER BY document_id,chunk_index LIMIT 20000",[uid]),
  rows("SELECT * FROM goals WHERE user_id=$1 ORDER BY created_at",[uid]),
  rows("SELECT * FROM habits WHERE user_id=$1 ORDER BY created_at",[uid]),
  rows("SELECT * FROM habit_completions WHERE user_id=$1 ORDER BY completed_at",[uid]),
  rows("SELECT * FROM assistant_notifications WHERE user_id=$1 ORDER BY created_at",[uid]),
  rows("SELECT account_email,scopes,status,connected_at,last_used_at,last_error FROM google_connections WHERE user_id=$1",[uid]),
  rows("SELECT github_user_id,login,status,connected_at,updated_at,last_used_at,last_error FROM github_connections WHERE user_id=$1",[uid]),
  rows("SELECT plan_code,status,period_start,period_end,unit_bonus,assigned_by,created_at,updated_at FROM user_plan_assignments WHERE user_id=$1",[uid]),
  rows("SELECT provider,plan_code,billing_cycle,status,current_period_start,current_period_end,cancel_at_period_end,cancelled_at,created_at,updated_at FROM billing_subscriptions WHERE user_id=$1",[uid]),
  rows("SELECT addon_code,amount_inr,currency,status,paid_at,created_at,updated_at FROM addon_orders WHERE user_id=$1 ORDER BY created_at",[uid]),
  rows("SELECT o.id,o.name,o.slug,m.role,m.status,m.joined_at FROM organization_memberships m JOIN organizations o ON o.id=m.organization_id WHERE m.user_id=$1 ORDER BY m.joined_at",[uid]),
  rows("SELECT tool_name,provider,risk_level,status,approval_required,error_message,started_at,completed_at FROM tool_runs WHERE user_id=$1 ORDER BY started_at LIMIT 5000",[uid]),
  rows("SELECT purpose,provider,model,status,fallback_used,input_tokens,output_tokens,total_tokens,latency_ms,error_code,created_at,completed_at FROM ai_runs WHERE user_id=$1 ORDER BY created_at LIMIT 5000",[uid])
 ]);
 res.setHeader("Content-Disposition",'attachment; filename="secondbrain-data-export.json"');
 res.json({
  export_version:1,generated_at:new Date().toISOString(),
  account:{id:uid,email:req.user.email||null,name:req.user.name||null},
  preferences,conversations,messages,tasks,notes,reminders,calendar,memories,
  documents:{items:documents,chunks},goals,habits,habit_completions:habitCompletions,
  notifications,integrations:{google,github},plan_assignments:plans,billing_subscriptions:billing,
  addon_orders:addons,organizations,tool_runs:toolRuns,ai_runs:aiRuns,
  excluded:["OAuth tokens and encryption material","developer API key hashes","provider secrets"]
 });
}