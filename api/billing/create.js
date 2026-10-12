import { db } from "hatchable";
import { razorpayRequest,razorpayPublicKey,razorpayPlanEnv } from "../../lib/razorpay.js";
import { upsertSubscriptionFromProvider } from "../../lib/billing.js";
export const access="user";
export const methods=["POST"];
const plans=new Set(["PLUS","PRO"]);
const cycles=new Set(["MONTHLY","ANNUAL"]);
export default async function(req,res){
 const planCode=String(req.body?.plan_code||"").toUpperCase(),billingCycle=String(req.body?.billing_cycle||"MONTHLY").toUpperCase();
 if(!plans.has(planCode)||!cycles.has(billingCycle))return res.status(400).json({error:"Valid plan_code and billing_cycle are required."});
 const existing=(await db.query("SELECT provider_subscription_id,status,plan_code,billing_cycle FROM billing_subscriptions WHERE user_id=$1 LIMIT 1",[req.user.id])).rows[0];
 if(existing&&!["CANCELLED","COMPLETED","EXPIRED"].includes(existing.status)){
  return res.status(409).json({error:"subscription_exists",message:"An existing subscription must be cancelled or completed before creating another.",subscription:existing});
 }
 const plan=razorpayPlanEnv(planCode,billingCycle);
 if(!plan.value)return res.status(503).json({error:"billing_setup_required",message:"This billing plan is not configured yet.",missing:plan.key});
 try{
  const entity=await razorpayRequest("/subscriptions",{method:"POST",body:{
   plan_id:plan.value,
   total_count:billingCycle==="ANNUAL"?10:120,
   quantity:1,
   customer_notify:0,
   notes:{app:"SecondBrain",plan_code:planCode,billing_cycle:billingCycle,user_ref:req.user.id}
  }});
  if(String(entity?.plan_id||"")!==String(plan.value))return res.status(502).json({error:"billing_plan_mismatch",message:"Billing provider returned an unexpected plan mapping."});
  const row=await upsertSubscriptionFromProvider({userId:req.user.id,planCode,billingCycle,entity});
  const keyId=await razorpayPublicKey();
  res.status(201).json({
   provider:"razorpay",key_id:keyId,subscription_id:row.provider_subscription_id,
   hosted_url:entity.short_url||null,plan_code:row.plan_code,billing_cycle:row.billing_cycle,status:row.status
  });
 }catch(e){res.status(e.status||502).json({error:"billing_provider_error",message:String(e.message||e).slice(0,300)})}
}