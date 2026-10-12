import { getUsageState } from "../../lib/entitlements.js";
import { addonCatalogForPlan } from "../../lib/addons.js";
import { razorpayPublicKey } from "../../lib/razorpay.js";
export const access="user";
export const methods=["GET"];
export default async function(req,res){
 const state=await getUsageState(req.user.id);
 const addons=await addonCatalogForPlan(state.plan.plan_code);
 let billing_available=false;try{await razorpayPublicKey();billing_available=true}catch{}
 res.json({
  plan_code:state.plan.plan_code,
  active_effects:state.addons,
  billing_available,
  currency:"INR",
  addons:addons.map(a=>({
   code:a.code,display_name:a.display_name,description:a.description,price_inr:a.price_inr,
   effects:a.effects,validity_days:a.validity_days,eligible:a.eligible
  }))
 });
}