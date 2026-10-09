import { db } from "hatchable";
import { getPlan } from "../../lib/entitlements.js";
import { razorpayRequest,razorpayPublicKey } from "../../lib/razorpay.js";
export const access="member";
export const methods=["POST"];
export default async function(req,res){
 const code=String(req.body?.addon_code||"").trim().toUpperCase();
 if(!code)return res.status(400).json({error:"addon_code is required"});
 const addon=(await db.query("SELECT code,display_name,price_inr,eligible_plans,active FROM addon_catalog WHERE code=$1",[code])).rows[0];
 if(!addon?.active)return res.status(404).json({error:"Add-on not found."});
 const plan=await getPlan(req.member.id);
 if(!Array.isArray(addon.eligible_plans)||!addon.eligible_plans.includes(plan.plan_code))return res.status(403).json({error:"addon_not_eligible",message:"This add-on is not available for your current plan."});
 const receipt="addon_"+crypto.randomUUID().replaceAll("-","").slice(0,28);
 try{
  const entity=await razorpayRequest("/orders",{method:"POST",body:{
   amount:Number(addon.price_inr)*100,currency:"INR",receipt,
   notes:{app:"SecondBrain",addon_code:addon.code,user_ref:req.member.id}
  }});
  if(!entity?.id||Number(entity.amount)!==Number(addon.price_inr)*100||String(entity.currency)!=="INR")return res.status(502).json({error:"billing_order_mismatch",message:"Billing provider returned an unexpected order."});
  const order=(await db.query(`
   INSERT INTO addon_orders(user_id,addon_code,provider_order_id,amount_inr,currency,status)
   VALUES($1,$2,$3,$4,'INR','CREATED')
   RETURNING id,addon_code,provider_order_id,amount_inr,currency,status,created_at
  `,[req.member.id,addon.code,String(entity.id),Number(addon.price_inr)])).rows[0];
  res.status(201).json({order_id:order.provider_order_id,key_id:await razorpayPublicKey(),amount_paise:order.amount_inr*100,currency:order.currency,addon:{code:addon.code,display_name:addon.display_name,price_inr:addon.price_inr}});
 }catch(e){
  const status=e.code==="BILLING_SETUP_REQUIRED"?503:(e.status||502);
  res.status(status).json({error:e.code==="BILLING_SETUP_REQUIRED"?"billing_setup_required":"billing_provider_error",message:String(e.message||e).slice(0,300)});
 }
}