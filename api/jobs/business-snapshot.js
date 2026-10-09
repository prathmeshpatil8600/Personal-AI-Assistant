import { db } from "hatchable";
import { computeBusinessMetrics } from "../../lib/business-metrics.js";
export const access="scheduler";
export const methods=["POST"];
export default async function(req,res){
 const m=await computeBusinessMetrics();
 const safe={
  generated_at:m.generated_at,pricing_status:m.pricing_status,revenue:m.revenue,users:m.users,
  subscriptions:m.subscriptions,cost:m.cost,margin:m.margin,
  usage:{month_quota_units:m.usage.month_quota_units,input_tokens:m.usage.input_tokens,output_tokens:m.usage.output_tokens,events:m.usage.events,by_plan:m.usage.by_plan,by_type:m.usage.by_type}
 };
 await db.query("INSERT INTO business_daily_snapshots(snapshot_date,metrics) VALUES(CURRENT_DATE,$1::jsonb) ON CONFLICT(snapshot_date) DO UPDATE SET metrics=EXCLUDED.metrics,created_at=now()",[JSON.stringify(safe)]);
 res.json({ok:true,snapshot_date:new Date().toISOString().slice(0,10)});
}