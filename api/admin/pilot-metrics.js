import { db } from "hatchable";
export const access="admin";
export const methods=["GET"];
export default async function(req,res){
 const [participants,onboarding,usage,latency,feedback]=await Promise.all([
  db.query("SELECT status,count(*)::int n FROM pilot_participants GROUP BY status"),
  db.query("SELECT status,count(*)::int n FROM user_onboarding GROUP BY status"),
  db.query(`SELECT count(DISTINCT user_id)::int active_users_7d,COALESCE(sum(quota_units),0)::bigint units_7d,
   COALESCE(sum(estimated_cost_microusd) FILTER (WHERE priced),0)::bigint cost_microusd_7d
   FROM usage_events WHERE occurred_at>=now()-interval '7 days'`),
  db.query(`SELECT provider,count(*)::int runs,
   round(avg(latency_ms))::int avg_latency_ms,
   percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms)::int p50_latency_ms,
   percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)::int p95_latency_ms
   FROM ai_runs WHERE created_at>=now()-interval '7 days' AND latency_ms IS NOT NULL GROUP BY provider`),
  db.query("SELECT severity,status,count(*)::int n FROM pilot_feedback GROUP BY severity,status")
 ]);
 res.json({generated_at:new Date().toISOString(),participants:participants.rows,onboarding:onboarding.rows,usage:usage.rows[0],ai_latency:latency.rows,feedback:feedback.rows});
}