import { db } from "hatchable";

const DEFAULT_PLAN="FREE";
const VALID_FEATURES=new Set([
 "chat","documents","google_integration","github_integration",
 "scheduled_briefings","advanced_automation","premium_models"
]);

function unitsForEvent(eventType,{inputTokens,outputTokens,bytesProcessed,itemCount,metadata}={}){
 if(eventType==="ai_generation")return Math.max(1,Math.ceil(((Number(inputTokens)||0)+(Number(outputTokens)||0))/1000));
 if(eventType==="document_ingest")return Math.max(1,Math.ceil((Number(bytesProcessed)||0)/(1024*1024))+(Number(itemCount)||0));
 if(eventType==="embedding_query")return 1;
 if(eventType==="tool_execution")return String(metadata?.status||"")==="BLOCKED"?0:1;
 return Math.max(1,Number(itemCount)||1);
}

export function quotaUnitsForEvent(eventType,data){return unitsForEvent(eventType,data)}

export async function getPlan(userId){
 const assigned=(await db.query(`
  SELECT a.plan_code,a.status,a.period_start,a.period_end,a.unit_bonus,
         p.display_name,p.monthly_units,p.entitlements
  FROM user_plan_assignments a
  JOIN plan_definitions p ON p.code=a.plan_code AND p.active=true
  WHERE a.user_id=$1
  LIMIT 1
 `,[userId])).rows[0];
 if(assigned){
  if(new Date(assigned.period_end).getTime()<=Date.now()){
   const rolled=(await db.query("UPDATE user_plan_assignments SET period_start=date_trunc('month',now()),period_end=date_trunc('month',now())+interval '1 month',updated_at=now() WHERE user_id=$1 RETURNING plan_code,status,period_start,period_end,unit_bonus",[userId])).rows[0];
   return {...assigned,...rolled};
  }
  return assigned;
 }
 const fallback=(await db.query("SELECT code AS plan_code,'ACTIVE'::text AS status,date_trunc('month',now()) AS period_start,date_trunc('month',now())+interval '1 month' AS period_end,0::int AS unit_bonus,display_name,monthly_units,entitlements FROM plan_definitions WHERE code=$1 AND active=true",[DEFAULT_PLAN])).rows[0];
 if(!fallback)throw new Error("Default plan is not configured.");
 return fallback;
}

export async function getUsageState(userId){
 const plan=await getPlan(userId);
 const used=Number((await db.query("SELECT COALESCE(sum(quota_units),0)::int AS units FROM usage_events WHERE user_id=$1 AND occurred_at >= $2 AND occurred_at < $3",[userId,plan.period_start,plan.period_end])).rows[0]?.units||0);
 const allowance=Number(plan.monthly_units||0)+Number(plan.unit_bonus||0);
 return {plan,used_units:used,allowance_units:allowance,remaining_units:Math.max(0,allowance-used),limit_reached:used>=allowance};
}

export async function requireFeature(userId,feature){
 if(!VALID_FEATURES.has(feature))throw new Error("Unknown entitlement feature.");
 const state=await getUsageState(userId);
 if(state.plan.status!=="ACTIVE"&&state.plan.status!=="GRACE"){
  return {ok:false,reason:"PLAN_INACTIVE",...state};
 }
 if(state.plan.entitlements?.[feature]!==true){
  return {ok:false,reason:"FEATURE_NOT_INCLUDED",feature,...state};
 }
 return {ok:true,feature,...state};
}

export async function requireUnits(userId,estimatedUnits=1){
 const state=await getUsageState(userId),units=Math.max(0,Math.ceil(Number(estimatedUnits)||0));
 if(state.plan.status!=="ACTIVE"&&state.plan.status!=="GRACE")return {ok:false,reason:"PLAN_INACTIVE",required_units:units,...state};
 if(state.used_units+units>state.allowance_units)return {ok:false,reason:"MONTHLY_LIMIT",required_units:units,...state};
 return {ok:true,required_units:units,...state};
}

export async function requireCountLimit(userId,key,currentCount){
 const state=await getUsageState(userId);
 const limit=Number(state.plan.entitlements?.[key]);
 if(!Number.isFinite(limit)||limit<0)return {ok:true,limit:null,current:Number(currentCount)||0,...state};
 if(Number(currentCount)>=limit)return {ok:false,reason:"RESOURCE_LIMIT",resource:key,limit,current:Number(currentCount)||0,...state};
 return {ok:true,resource:key,limit,current:Number(currentCount)||0,...state};
}

export function entitlementError(res,gate){
 const status=gate.reason==="PLAN_INACTIVE"?403:429;
 return res.status(status).json({
  error:"entitlement_limit",
  code:gate.reason,
  feature:gate.feature||null,
  resource:gate.resource||null,
  plan:gate.plan?.plan_code||DEFAULT_PLAN,
  used_units:gate.used_units,
  allowance_units:gate.allowance_units,
  remaining_units:gate.remaining_units,
  required_units:gate.required_units||null,
  limit:gate.limit??null,
  message:gate.reason==="FEATURE_NOT_INCLUDED"?"This feature is not included in your current plan.":gate.reason==="RESOURCE_LIMIT"?"Your current plan has reached this resource limit.":gate.reason==="PLAN_INACTIVE"?"Your plan is not active.":"Your monthly AI usage allowance has been reached."
 });
}