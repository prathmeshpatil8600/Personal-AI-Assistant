import { getUsageState } from "../../lib/entitlements.js";
export const access="member";
export const methods=["GET"];
export default async function(req,res){
 const s=await getUsageState(req.member.id);
 res.json({
  plan:{code:s.plan.plan_code,name:s.plan.display_name,status:s.plan.status,entitlements:s.plan.entitlements},
  period:{start:s.plan.period_start,end:s.plan.period_end},
  usage:{used_units:s.used_units,allowance_units:s.allowance_units,remaining_units:s.remaining_units,limit_reached:s.limit_reached},
  addons:s.addons
 });
}