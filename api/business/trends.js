import { db } from "hatchable";
export const access="admin";
export const methods=["GET"];
export default async function(req,res){
 const days=Math.max(7,Math.min(365,Number.parseInt(req.query?.days,10)||90));
 const rows=(await db.query("SELECT snapshot_date,metrics FROM business_daily_snapshots WHERE snapshot_date>=CURRENT_DATE-$1::int ORDER BY snapshot_date ASC",[days])).rows;
 res.json({days,points:rows.map(r=>({
  date:r.snapshot_date,
  mrr_inr:Number(r.metrics?.revenue?.mrr_inr||0),
  active_paid_users:Number(r.metrics?.revenue?.active_paid_users||0),
  known_users:Number(r.metrics?.users?.known_users||0),
  conversion_percent:Number(r.metrics?.users?.paid_conversion_percent||0),
  quota_units:Number(r.metrics?.usage?.month_quota_units||0),
  priced_cost_usd:Number(r.metrics?.cost?.priced_cost_usd||0),
  cost_coverage_percent:Number(r.metrics?.cost?.cost_coverage_percent||0)
 }))});
}