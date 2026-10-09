import { db } from "hatchable";
import { razorpayPlanEnv } from "../../lib/razorpay.js";
export const access="member";
export const methods=["GET"];

const testPrices={
 FREE:{MONTHLY:0,ANNUAL:0},
 PLUS:{MONTHLY:499,ANNUAL:4999},
 PRO:{MONTHLY:1499,ANNUAL:14999}
};

export default async function(req,res){
 const plans=(await db.query("SELECT code,display_name,monthly_units,entitlements FROM plan_definitions WHERE active=true ORDER BY CASE code WHEN 'FREE' THEN 1 WHEN 'PLUS' THEN 2 ELSE 3 END")).rows;
 const rows=plans.map(p=>({
  ...p,
  pricing_status:"PROVISIONAL_TEST_PRICE",
  prices_inr:testPrices[p.code]||{MONTHLY:null,ANNUAL:null},
  billing_available:{
   MONTHLY:p.code==="FREE"?true:Boolean(razorpayPlanEnv(p.code,"MONTHLY").value),
   ANNUAL:p.code==="FREE"?true:Boolean(razorpayPlanEnv(p.code,"ANNUAL").value)
  }
 }));
 res.json({currency:"INR",pricing_status:"PROVISIONAL_TEST_PRICE",plans:rows});
}