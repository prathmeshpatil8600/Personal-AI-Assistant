import { db } from "hatchable";
import { razorpayRequest } from "../../lib/razorpay.js";
import { upsertSubscriptionFromProvider } from "../../lib/billing.js";
export const access="member";
export const methods=["POST"];
export default async function(req,res){
 const mode=String(req.body?.mode||"period_end").toLowerCase();
 if(!["period_end","immediate"].includes(mode))return res.status(400).json({error:"mode must be period_end or immediate"});
 const sub=(await db.query("SELECT * FROM billing_subscriptions WHERE user_id=$1 LIMIT 1",[req.member.id])).rows[0];
 if(!sub?.provider_subscription_id)return res.status(404).json({error:"No subscription found."});
 if(["CANCELLED","COMPLETED","EXPIRED"].includes(sub.status))return res.status(409).json({error:"Subscription is already inactive."});
 try{
  const entity=await razorpayRequest("/subscriptions/"+encodeURIComponent(sub.provider_subscription_id)+"/cancel",{method:"POST",body:{cancel_at_cycle_end:mode==="period_end"?1:0}});
  const row=await upsertSubscriptionFromProvider({userId:req.member.id,planCode:sub.plan_code,billingCycle:sub.billing_cycle,entity});
  if(mode==="immediate")await db.query("UPDATE billing_subscriptions SET cancelled_at=now() WHERE id=$1",[row.id]);
  res.json({ok:true,status:row.status,cancel_at_period_end:row.cancel_at_period_end,current_period_end:row.current_period_end});
 }catch(e){res.status(e.status||502).json({error:"billing_cancel_failed",message:String(e.message||e).slice(0,300)})}
}