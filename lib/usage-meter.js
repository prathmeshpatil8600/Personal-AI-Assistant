import { db } from "hatchable";
import { getPlan, quotaUnitsForEvent } from "./entitlements.js";

function safeInt(v){
 const n=Number(v);
 return Number.isFinite(n)&&n>=0?Math.floor(n):null;
}
function safeMeta(value){
 try{return JSON.parse(JSON.stringify(value??{}))}catch{return{}}
}
function sourceFromPurpose(purpose=""){
 const p=String(purpose||"").toLowerCase();
 if(p.includes("briefing")||p.includes("job")||p.includes("automation"))return"automation";
 if(p.includes("document"))return"document";
 return"app";
}

async function findRate({provider,meterKey,model,at=new Date()}){
 if(!provider||!meterKey)return null;
 const r=await db.query(`
  SELECT input_microusd_per_million,output_microusd_per_million,
         fixed_microusd_per_event,microusd_per_mb,microusd_per_item
  FROM usage_rate_cards
  WHERE active=true
    AND provider=$1
    AND meter_key=$2
    AND (model IS NULL OR model=$3)
    AND effective_from <= $4
    AND (effective_to IS NULL OR effective_to > $4)
  ORDER BY CASE WHEN model=$3 THEN 0 ELSE 1 END,effective_from DESC
  LIMIT 1
 `,[provider,meterKey,model||null,at]);
 return r.rows[0]||null;
}

function calculateCost(rate,{inputTokens,outputTokens,bytesProcessed,itemCount}){
 if(!rate)return null;
 const input=BigInt(safeInt(inputTokens)||0);
 const output=BigInt(safeInt(outputTokens)||0);
 const bytes=BigInt(safeInt(bytesProcessed)||0);
 const items=BigInt(safeInt(itemCount)||0);
 let micros=BigInt(rate.fixed_microusd_per_event||0);
 micros+=(input*BigInt(rate.input_microusd_per_million||0))/1000000n;
 micros+=(output*BigInt(rate.output_microusd_per_million||0))/1000000n;
 micros+=(bytes*BigInt(rate.microusd_per_mb||0))/(1024n*1024n);
 micros+=items*BigInt(rate.microusd_per_item||0);
 return Number(micros);
}

export async function recordUsageEvent({
 userId,eventKey,eventType,source="app",provider=null,model=null,purpose=null,
 aiRunId=null,toolRunId=null,documentId=null,inputTokens=null,outputTokens=null,
 bytesProcessed=null,itemCount=null,metadata={}
}){
 if(!userId||!eventKey||!eventType)return null;
 const occurredAt=new Date();
 const rate=await findRate({provider,meterKey:eventType,model,at:occurredAt});
 const cost=calculateCost(rate,{inputTokens,outputTokens,bytesProcessed,itemCount});
 const safeMetadata=safeMeta(metadata);
 const quotaUnits=quotaUnitsForEvent(eventType,{inputTokens,outputTokens,bytesProcessed,itemCount,metadata:safeMetadata});
 let planCode=null;try{planCode=(await getPlan(userId))?.plan_code||null}catch(_){}
 try{
  const r=await db.query(`
   INSERT INTO usage_events(
    user_id,event_key,event_type,source,provider,model,purpose,ai_run_id,tool_run_id,document_id,
    input_tokens,output_tokens,bytes_processed,item_count,estimated_cost_microusd,priced,metadata,occurred_at,quota_units,plan_code
   ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20)
   ON CONFLICT(event_key) DO NOTHING
   RETURNING id
  `,[
   userId,String(eventKey).slice(0,240),String(eventType).slice(0,80),String(source).slice(0,40),
   provider?String(provider).slice(0,80):null,model?String(model).slice(0,160):null,purpose?String(purpose).slice(0,120):null,
   aiRunId||null,toolRunId||null,documentId||null,safeInt(inputTokens),safeInt(outputTokens),safeInt(bytesProcessed),safeInt(itemCount),
   cost,cost!==null,JSON.stringify(safeMetadata),occurredAt,quotaUnits,planCode
  ]);
  return r.rows[0]?.id||null;
 }catch(_){return null}
}

export async function recordAiUsage({userId,runId,provider,model,purpose,usage,fallbackUsed=false,status="COMPLETED"}){
 const input=safeInt(usage?.input??usage?.prompt_tokens??usage?.input_tokens) || 0;
 const output=safeInt(usage?.output??usage?.completion_tokens??usage?.output_tokens) || 0;
 return recordUsageEvent({
  userId,eventKey:"ai:"+runId,eventType:"ai_generation",source:sourceFromPurpose(purpose),
  provider,model,purpose,aiRunId:runId,inputTokens:input,outputTokens:output,itemCount:1,
  metadata:{fallback_used:Boolean(fallbackUsed),status}
 });
}

export async function recordToolUsage({userId,runId,provider,toolName,status,riskLevel,approvalRequired,latencyMs}){
 return recordUsageEvent({
  userId,eventKey:"tool:"+runId,eventType:"tool_execution",source:"tool",
  provider,model:toolName,toolRunId:runId,itemCount:1,
  metadata:{tool_name:toolName,status,risk_level:riskLevel,approval_required:Boolean(approvalRequired),latency_ms:safeInt(latencyMs)}
 });
}