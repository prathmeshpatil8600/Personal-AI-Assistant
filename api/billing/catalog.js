import { razorpayPlanEnv } from "../../lib/razorpay.js";
export const access="user";
export const methods=["GET"];
export default async function(req,res){
 const rows=[];
 for(const plan_code of ["PLUS","PRO"])for(const billing_cycle of ["MONTHLY","ANNUAL"]){
  rows.push({plan_code,billing_cycle,available:Boolean(razorpayPlanEnv(plan_code,billing_cycle).value)});
 }
 res.json(rows);
}