import { db } from "hatchable";
import { computeUnitEconomics } from "../../lib/unit-economics.js";
import { runTrackedJob } from "../../lib/ops.js";
export const access="scheduler";
export const methods=["POST"];
export default async function(req,res){
 const result=await runTrackedJob("unit_economics_snapshot",async()=>{
  const e=await computeUnitEconomics();
  await db.query(`INSERT INTO unit_economics_daily_snapshots(
   snapshot_date,status,active_pilot_users,projected_monthly_ai_cost_usd_per_active_user,
   plus_break_even_conversion_percent,blended_break_even_conversion_percent,metrics
  ) VALUES(CURRENT_DATE,$1,$2,$3,$4,$5,$6::jsonb)
  ON CONFLICT(snapshot_date) DO UPDATE SET
   status=EXCLUDED.status,
   active_pilot_users=EXCLUDED.active_pilot_users,
   projected_monthly_ai_cost_usd_per_active_user=EXCLUDED.projected_monthly_ai_cost_usd_per_active_user,
   plus_break_even_conversion_percent=EXCLUDED.plus_break_even_conversion_percent,
   blended_break_even_conversion_percent=EXCLUDED.blended_break_even_conversion_percent,
   metrics=EXCLUDED.metrics,updated_at=now()`,[
    e.risk.status,
    Number(e.pilot.active_users||0),
    Number(e.pilot.projected_monthly_ai_cost_usd_per_active_user||0),
    e.cross_subsidy.plus_only_break_even_paid_conversion_percent,
    e.cross_subsidy.blended_plus_pro_break_even_paid_conversion_percent,
    JSON.stringify(e)
   ]);
  return {status:e.risk.status,active_pilot_users:e.pilot.active_users};
 });
 res.json(result);
}