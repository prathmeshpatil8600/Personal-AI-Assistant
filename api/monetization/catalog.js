import { db } from "hatchable";
import { razorpayPlanEnv } from "../../lib/razorpay.js";
import { COMMERCIAL_PRICES,PRICING_STATUS,CURRENCY } from "../../lib/commercial-pricing.js";
export const access="member";
export const methods=["GET"];

const testPrices=COMMERCIAL_PRICES;

export default async function(req,res){
 const plans=(await db.query("SELECT code,display_name,monthly_units,entitlements FROM plan_definitions WHERE active=true ORDER BY CASE code WHEN 'FREE' THEN 1 WHEN 'PLUS' THEN 2 ELSE 3 END")).rows;
 const rows=plans.map(p=>({
  ...p,
  pricing_status:PRICING_STATUS,
  prices_inr:testPrices[p.code]||{MONTHLY:null,ANNUAL:null},
  billing_available:{
   MONTHLY:p.code==="FREE"?true:Boolean(razorpayPlanEnv(p.code,"MONTHLY").value),
   ANNUAL:p.code==="FREE"?true:Boolean(razorpayPlanEnv(p.code,"ANNUAL").value)
  }
 }));
 res.json({currency:CURRENCY,pricing_status:PRICING_STATUS,plans:rows});
}