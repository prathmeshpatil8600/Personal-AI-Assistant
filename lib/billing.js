import { db } from "hatchable";

const ACTIVE_STATES=new Set(["ACTIVE","AUTHENTICATED"]);
const PROVIDER_STATUS={
 created:"CREATED",authenticated:"AUTHENTICATED",active:"ACTIVE",pending:"PAST_DUE",
 halted:"PAST_DUE",paused:"PAUSED",cancelled:"CANCELLED",completed:"COMPLETED",expired:"EXPIRED"
};

function cycleSeconds(cycle){return cycle==="ANNUAL"?365*24*60*60:30*24*60*60}
function planFromNotes(entity){
 const p=String(entity?.notes?.plan_code||"").toUpperCase();
 return p==="PLUS"||p==="PRO"?p:null;
}
function cycleFromNotes(entity){
 const c=String(entity?.notes?.billing_cycle||"").toUpperCase();
 return c==="MONTHLY"||c==="ANNUAL"?c:null;
}
function ts(v){const n=Number(v);return Number.isFinite(n)&&n>0?new Date(n*1000):null}

export function normalizeSubscriptionEntity(entity){
 const status=PROVIDER_STATUS[String(entity?.status||"").toLowerCase()]||"CREATED";
 return {
  provider_subscription_id:String(entity?.id||""),
  provider_plan_id:String(entity?.plan_id||"")||null,
  plan_code:planFromNotes(entity),
  billing_cycle:cycleFromNotes(entity),
  status,
  current_period_start:ts(entity?.current_start)||ts(entity?.start_at),
  current_period_end:ts(entity?.current_end)||ts(entity?.end_at),
  cancel_at_period_end:Boolean(entity?.cancel_at_cycle_end)
 };
}

export async function syncEntitlementFromBilling(userId){
 const sub=(await db.query("SELECT * FROM billing_subscriptions WHERE user_id=$1 LIMIT 1",[userId])).rows[0];
 if(!sub||!ACTIVE_STATES.has(sub.status)){
  await db.query("DELETE FROM user_plan_assignments WHERE user_id=$1 AND assigned_by='billing'",[userId]);
  return {plan_code:"FREE",source:"fallback"};
 }
 const start=new Date();start.setUTCDate(1);start.setUTCHours(0,0,0,0);
 const end=new Date(start);end.setUTCMonth(end.getUTCMonth()+1);
 await db.query(`
  INSERT INTO user_plan_assignments(user_id,plan_code,status,period_start,period_end,unit_bonus,assigned_by)
  VALUES($1,$2,'ACTIVE',$3,$4,0,'billing')
  ON CONFLICT(user_id) DO UPDATE SET plan_code=EXCLUDED.plan_code,status='ACTIVE',period_start=EXCLUDED.period_start,
   period_end=EXCLUDED.period_end,unit_bonus=0,assigned_by='billing',updated_at=now()
 `,[userId,sub.plan_code,start,end]);
 return {plan_code:sub.plan_code,source:"billing"};
}

export async function upsertSubscriptionFromProvider({userId,planCode,billingCycle,entity}){
 const n=normalizeSubscriptionEntity(entity);
 const finalPlan=planCode||n.plan_code,finalCycle=billingCycle||n.billing_cycle;
 if(!finalPlan||!finalCycle||!n.provider_subscription_id)throw new Error("Provider subscription metadata is incomplete.");
 if(!["PLUS","PRO"].includes(finalPlan)||!["MONTHLY","ANNUAL"].includes(finalCycle))throw new Error("Invalid server billing plan mapping.");
 const row=(await db.query(`
  INSERT INTO billing_subscriptions(user_id,provider,plan_code,billing_cycle,provider_subscription_id,provider_plan_id,status,current_period_start,current_period_end,cancel_at_period_end,last_event_at,metadata)
  VALUES($1,'razorpay',$2,$3,$4,$5,$6,$7,$8,$9,now(),$10::jsonb)
  ON CONFLICT(user_id) DO UPDATE SET plan_code=EXCLUDED.plan_code,billing_cycle=EXCLUDED.billing_cycle,
   provider_subscription_id=EXCLUDED.provider_subscription_id,provider_plan_id=EXCLUDED.provider_plan_id,
   status=EXCLUDED.status,current_period_start=EXCLUDED.current_period_start,current_period_end=EXCLUDED.current_period_end,
   cancel_at_period_end=EXCLUDED.cancel_at_period_end,last_event_at=now(),metadata=EXCLUDED.metadata,updated_at=now()
  RETURNING *
 `,[userId,finalPlan,finalCycle,n.provider_subscription_id,n.provider_plan_id,n.status,n.current_period_start,n.current_period_end,n.cancel_at_period_end,JSON.stringify({provider_status:entity?.status||null,hosted_url:entity?.short_url||null})])).rows[0];
 await syncEntitlementFromBilling(userId);
 return row;
}

export async function applyVerifiedBillingEvent(payload){
 const eventType=String(payload?.event||"");
 const entity=payload?.payload?.subscription?.entity;
 if(!entity?.id)return {ignored:true,reason:"NO_SUBSCRIPTION_ENTITY"};
 const sub=(await db.query("SELECT * FROM billing_subscriptions WHERE provider='razorpay' AND provider_subscription_id=$1 LIMIT 1",[String(entity.id)])).rows[0];
 if(!sub)return {ignored:true,reason:"UNKNOWN_SUBSCRIPTION"};
 const n=normalizeSubscriptionEntity(entity);
 await db.query(`
  UPDATE billing_subscriptions SET status=$1,provider_plan_id=COALESCE($2,provider_plan_id),
   current_period_start=COALESCE($3,current_period_start),current_period_end=COALESCE($4,current_period_end),
   cancel_at_period_end=$5,last_event_at=now(),updated_at=now()
  WHERE id=$6
 `,[n.status,n.provider_plan_id,n.current_period_start,n.current_period_end,n.cancel_at_period_end,sub.id]);
 await syncEntitlementFromBilling(sub.user_id);
 return {ignored:false,user_id:sub.user_id,status:n.status,event_type:eventType};
}