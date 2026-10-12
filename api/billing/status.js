import { db } from "hatchable";
import { razorpayRequest } from "../../lib/razorpay.js";
import { upsertSubscriptionFromProvider } from "../../lib/billing.js";
import { enforceUserRateLimit,rateLimitError } from "../../lib/rate-limit.js";
export const access="user";
export const methods=["GET"];
function view(s){return s?{provider:s.provider,plan_code:s.plan_code,billing_cycle:s.billing_cycle,status:s.status,provider_subscription_id:s.provider_subscription_id,current_period_start:s.current_period_start,current_period_end:s.current_period_end,cancel_at_period_end:s.cancel_at_period_end,cancelled_at:s.cancelled_at,last_payment_id:s.last_payment_id,last_invoice_id:s.last_invoice_id,hosted_url:s.metadata?.hosted_url||null,updated_at:s.updated_at}:null}
export default async function(req,res){
 if(String(req.query?.refresh||"")==="1"){const rate=await enforceUserRateLimit(req.user.id,"billing_refresh",{limit:10,windowSeconds:300});if(!rate.ok)return rateLimitError(res,rate)}
 let sub=(await db.query("SELECT * FROM billing_subscriptions WHERE user_id=$1 LIMIT 1",[req.user.id])).rows[0];
 if(!sub)return res.json({subscription:null});
 if(String(req.query?.refresh||"")==="1"&&sub.provider_subscription_id){
  try{
   const entity=await razorpayRequest("/subscriptions/"+encodeURIComponent(sub.provider_subscription_id));
   if(sub.provider_plan_id&&entity?.plan_id&&String(entity.plan_id)!==String(sub.provider_plan_id))return res.status(409).json({error:"billing_plan_mismatch",subscription:view(sub)});
   sub=await upsertSubscriptionFromProvider({userId:req.user.id,planCode:sub.plan_code,billingCycle:sub.billing_cycle,entity});
  }catch(e){return res.status(e.status||502).json({error:"billing_refresh_failed",message:String(e.message||e).slice(0,300),subscription:view(sub)})}
 }
 res.json({subscription:view(sub)});
}