import { db } from "hatchable";
export const access="user";
export const methods=["GET"];

async function rows(sql,p){try{return (await db.query(sql,p)).rows}catch{return []}}

export default async function(req,res){
 const uid=req.user.id;
 const [
  preferences,conversations,messages,tasks,notes,reminders,documents,calendar,memories,notifications,
  goals,habits,habitCompletions,aiRuns,toolRuns,usage,plan,billing,addons,memberships,grievances,consents
 ]=await Promise.all([
  rows("SELECT preferred_language,response_style,theme,timezone,created_at,updated_at FROM user_preferences WHERE user_id=$1",[uid]),
  rows("SELECT id,title,summary,created_at,updated_at FROM conversations WHERE user_id=$1 ORDER BY created_at",[uid]),
  rows("SELECT conversation_id,role,content,created_at FROM conversation_messages WHERE user_id=$1 ORDER BY created_at",[uid]),
  rows("SELECT id,title,description,priority,status,due_at,created_at,updated_at FROM tasks WHERE user_id=$1 ORDER BY created_at",[uid]),
  rows("SELECT id,title,content,created_at,updated_at FROM notes WHERE user_id=$1 AND deleted_at IS NULL ORDER BY created_at",[uid]),
  rows("SELECT id,title,message,remind_at,status,created_at,updated_at FROM reminders WHERE user_id=$1 ORDER BY created_at",[uid]),
  rows("SELECT id,title,filename,mime_type,size_bytes,status,created_at,updated_at FROM documents WHERE user_id=$1 ORDER BY created_at",[uid]),
  rows("SELECT id,title,start_at,end_at,location,status,created_at,updated_at FROM calendar_events WHERE user_id=$1 ORDER BY start_at",[uid]),
  rows("SELECT id,category,memory_key,memory_value,importance,confidence,created_at,updated_at FROM memories WHERE user_id=$1 ORDER BY created_at",[uid]),
  rows("SELECT id,type,title,message,created_at,read_at FROM assistant_notifications WHERE user_id=$1 ORDER BY created_at",[uid]),
  rows("SELECT id,title,description,category,status,target_date,progress_percent,created_at,updated_at FROM goals WHERE user_id=$1 ORDER BY created_at",[uid]),
  rows("SELECT id,name,description,frequency,target_per_period,active,created_at,updated_at FROM habits WHERE user_id=$1 ORDER BY created_at",[uid]),
  rows("SELECT habit_id,completion_date,created_at FROM habit_completions WHERE user_id=$1 ORDER BY completion_date",[uid]),
  rows("SELECT purpose,requested_model,provider,model,status,fallback_used,input_tokens,output_tokens,total_tokens,latency_ms,error_code,created_at,completed_at FROM ai_runs WHERE user_id=$1 ORDER BY created_at",[uid]),
  rows("SELECT tool_name,status,created_at,completed_at FROM tool_runs WHERE user_id=$1 ORDER BY created_at",[uid]),
  rows("SELECT event_type,source,provider,model,input_tokens,output_tokens,bytes_processed,item_count,quota_units,occurred_at FROM usage_events WHERE user_id=$1 ORDER BY occurred_at",[uid]),
  rows("SELECT plan_code,status,period_start,period_end,unit_bonus,assigned_by FROM user_plan_assignments WHERE user_id=$1",[uid]),
  rows("SELECT provider,plan_code,billing_cycle,status,current_period_start,current_period_end,cancel_at_period_end,cancelled_at,created_at,updated_at FROM billing_subscriptions WHERE user_id=$1",[uid]),
  rows("SELECT ao.addon_code,ao.amount_inr,ao.currency,ao.status,ao.paid_at,ao.created_at FROM addon_orders ao WHERE ao.user_id=$1 ORDER BY ao.created_at",[uid]),
  rows("SELECT organization_id,role,status,joined_at,updated_at FROM organization_memberships WHERE user_id=$1 ORDER BY joined_at",[uid]),
  rows("SELECT id,category,message,status,resolution,created_at,updated_at,resolved_at FROM privacy_grievances WHERE user_id=$1 ORDER BY created_at",[uid]),
  rows("SELECT consent_key,policy_version,granted,source,created_at FROM privacy_consents WHERE user_id=$1 ORDER BY created_at",[uid])
 ]);
 res.setHeader?.("Content-Disposition","attachment; filename=secondbrain-data-export.json");
 res.json({exported_at:new Date().toISOString(),account:{id:uid,email:req.user.email||null,name:req.user.name||null},data:{preferences,conversations,messages,tasks,notes,reminders,documents,calendar,memories,notifications,goals,habits,habit_completions:habitCompletions,ai_runs:aiRuns,tool_runs:toolRuns,usage_events:usage,plan,billing,addons,organization_memberships:memberships,privacy_grievances:grievances,privacy_consents:consents}});
}