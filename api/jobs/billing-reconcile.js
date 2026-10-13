import { db } from "hatchable";
import { razorpayRequest } from "../../lib/razorpay.js";
import { upsertSubscriptionFromProvider } from "../../lib/billing.js";
import { runTrackedJob } from "../../lib/ops.js";
export const access="scheduler";
export const methods=["POST"];
export default async function(req,res){
 const result=await runTrackedJob("billing_reconcile",async()=>{
  const rows=(await db.query("SELECT user_id,plan_code,billing_cycle,provider_subscription_id,status,provider_plan_id FROM billing_subscriptions WHERE provider='razorpay' AND provider_subscription_id IS NOT NULL AND status NOT IN ('CANCELLED','COMPLETED','EXPIRED') ORDER BY updated_at ASC LIMIT 500")).rows;
  let checked=0,updated=0,failed=0;
  for(const sub of rows){
   try{
    const entity=await razorpayRequest("/subscriptions/"+encodeURIComponent(sub.provider_subscription_id));
    if(sub.provider_plan_id&&entity?.plan_id&&String(entity.plan_id)!==String(sub.provider_plan_id)){checked++;failed++;continue}
    await upsertSubscriptionFromProvider({userId:sub.user_id,planCode:sub.plan_code,billingCycle:sub.billing_cycle,entity});
    checked++;updated++;
   }catch(e){
    checked++;failed++;
    await db.query("UPDATE billing_subscriptions SET metadata=jsonb_set(COALESCE(metadata,'{}'::jsonb),'{last_reconcile_error}',to_jsonb($1::text),true),updated_at=now() WHERE user_id=$2",[String(e.message||e).slice(0,300),sub.user_id]).catch(()=>{});
   }
  }
  if(failed>0&&rows.length>0)throw new Error("Billing reconciliation had "+failed+" failed subscription checks out of "+checked+".");
  return {checked,updated,failed,reconciled_at:new Date().toISOString()};
 });
 res.json(result);
}