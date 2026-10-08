import { db } from "hatchable";
import { recordToolUsage } from "./usage-meter.js";
import { requireFeature } from "./entitlements.js";

export const TOOL_RISK={READ:"READ",WRITE:"WRITE",SENSITIVE:"SENSITIVE",DESTRUCTIVE:"DESTRUCTIVE"};
export const TOOL_REGISTRY={
 search_workspace:{risk:"READ",provider:"internal"},
 list_memory:{risk:"READ",provider:"internal"},
 save_memory:{risk:"WRITE",provider:"internal"},
 list_calendar:{risk:"READ",provider:"internal"},
 list_tasks:{risk:"READ",provider:"internal"},
 create_task:{risk:"WRITE",provider:"internal"},
 list_notes:{risk:"READ",provider:"internal"},
 create_reminder:{risk:"WRITE",provider:"internal"},
 google_search_gmail:{risk:"READ",provider:"google"},
 google_list_calendar:{risk:"READ",provider:"google"},
 google_search_drive:{risk:"READ",provider:"google"},
 github_list_repositories:{risk:"READ",provider:"github"},
 github_list_issues:{risk:"READ",provider:"github"},
 github_get_repository_content:{risk:"READ",provider:"github"},
 google_send_gmail:{risk:"SENSITIVE",provider:"google"},
 google_create_calendar_event:{risk:"SENSITIVE",provider:"google"},
 github_create_issue:{risk:"SENSITIVE",provider:"github"},
 github_add_issue_comment:{risk:"SENSITIVE",provider:"github"}
};

function safeJson(value){try{return JSON.parse(JSON.stringify(value??{}))}catch{return{unserializable:true}}}
function needsApproval(risk){return risk==="SENSITIVE"||risk==="DESTRUCTIVE"}

async function pendingOrApproved({userId,conversationId,toolName,risk,input}){
 const approved=await db.query("SELECT id FROM tool_approvals WHERE user_id=$1 AND tool_name=$2 AND input_json=$3::jsonb AND status='APPROVED' AND expires_at>now() AND conversation_id IS NOT DISTINCT FROM $4::uuid ORDER BY decided_at DESC NULLS LAST LIMIT 1",[userId,toolName,JSON.stringify(input),conversationId||null]);
 if(approved.rows[0]){await db.query("UPDATE tool_approvals SET status='CONSUMED' WHERE id=$1 AND user_id=$2",[approved.rows[0].id,userId]);return{approved:true,id:approved.rows[0].id}}
 const pending=await db.query("SELECT id,expires_at FROM tool_approvals WHERE user_id=$1 AND tool_name=$2 AND input_json=$3::jsonb AND status='PENDING' AND expires_at>now() AND conversation_id IS NOT DISTINCT FROM $4::uuid ORDER BY created_at DESC LIMIT 1",[userId,toolName,JSON.stringify(input),conversationId||null]);
 if(pending.rows[0])return{approved:false,id:pending.rows[0].id,expires_at:pending.rows[0].expires_at};
 const created=await db.query("INSERT INTO tool_approvals(user_id,conversation_id,tool_name,risk_level,input_json) VALUES($1,$2,$3,$4,$5::jsonb) RETURNING id,expires_at",[userId,conversationId||null,toolName,risk,JSON.stringify(input)]);
 return{approved:false,id:created.rows[0].id,expires_at:created.rows[0].expires_at};
}

export function governTools(tools,{userId,conversationId=null}={}){
 const governed={};
 for(const [name,tool] of Object.entries(tools||{})){
  const meta=TOOL_REGISTRY[name]||{risk:"SENSITIVE",provider:"internal"};
  governed[name]={...tool,execute:async(args={})=>{
   const input=safeJson(args),start=Date.now(),approvalRequired=needsApproval(meta.risk);let approvalId=null;
   const feature=meta.provider==="google"?"google_integration":meta.provider==="github"?"github_integration":null;
   if(feature){const gate=await requireFeature(userId,feature);if(!gate.ok)return{entitlement_required:true,code:gate.reason,feature,plan:gate.plan?.plan_code||"FREE",message:"This connected-tool capability is not included in the current plan."}}
   if(approvalRequired){
    const gate=await pendingOrApproved({userId,conversationId,toolName:name,risk:meta.risk,input});
    approvalId=gate.id||null;
    if(!gate.approved){
     const blocked=await db.query("INSERT INTO tool_runs(user_id,conversation_id,tool_name,provider,risk_level,input_json,status,approval_required,approval_id,latency_ms,completed_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,'BLOCKED',true,$7,$8,now()) RETURNING id",[userId,conversationId||null,name,meta.provider,meta.risk,JSON.stringify(input),gate.id,Date.now()-start]);
     await recordToolUsage({userId,runId:blocked.rows[0]?.id,provider:meta.provider,toolName:name,status:"BLOCKED",riskLevel:meta.risk,approvalRequired:true,latencyMs:Date.now()-start});
     return{approval_required:true,approval_id:gate.id,tool:name,risk_level:meta.risk,expires_at:gate.expires_at,message:"This action requires explicit approval before it can run."};
    }
   }
   const run=await db.query("INSERT INTO tool_runs(user_id,conversation_id,tool_name,provider,risk_level,input_json,status,approval_required,approval_id) VALUES($1,$2,$3,$4,$5,$6::jsonb,'RUNNING',$7,$8) RETURNING id",[userId,conversationId||null,name,meta.provider,meta.risk,JSON.stringify(input),approvalRequired,approvalId]);
   try{
    const result=await tool.execute(args);
    await db.query("UPDATE tool_runs SET result_json=$1::jsonb,status='COMPLETED',latency_ms=$2,completed_at=now() WHERE id=$3 AND user_id=$4",[JSON.stringify(safeJson(result)),Date.now()-start,run.rows[0].id,userId]);
    await recordToolUsage({userId,runId:run.rows[0].id,provider:meta.provider,toolName:name,status:"COMPLETED",riskLevel:meta.risk,approvalRequired,latencyMs:Date.now()-start});
    return result;
   }catch(e){
    await db.query("UPDATE tool_runs SET status='FAILED',error_message=$1,latency_ms=$2,completed_at=now() WHERE id=$3 AND user_id=$4",[String(e?.message||e).slice(0,1000),Date.now()-start,run.rows[0].id,userId]);
    await recordToolUsage({userId,runId:run.rows[0].id,provider:meta.provider,toolName:name,status:"FAILED",riskLevel:meta.risk,approvalRequired,latencyMs:Date.now()-start});
    throw e;
   }
  }};
 }
 return governed;
}