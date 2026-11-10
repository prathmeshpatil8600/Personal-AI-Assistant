import { db } from "hatchable";
import { monthlyRevenueInr,PRICING_STATUS } from "./commercial-pricing.js";

function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
function round2(v){return Math.round((Number(v)||0)*100)/100}

export async function computeBusinessMetrics(){
 const known=(await db.query(`
  WITH u AS (
   SELECT user_id FROM usage_events WHERE source<>'benchmark' AND COALESCE(purpose,'') NOT LIKE 'benchmark:%'
   UNION SELECT user_id FROM user_plan_assignments
   UNION SELECT user_id FROM billing_subscriptions
   UNION SELECT user_id FROM conversations
   UNION SELECT user_id FROM tasks
   UNION SELECT user_id FROM documents
   UNION SELECT user_id FROM memories
  )
  SELECT count(DISTINCT user_id)::int AS users FROM u
 `)).rows[0];

 const subs=(await db.query(`
  SELECT plan_code,billing_cycle,status,count(*)::int AS users
  FROM billing_subscriptions
  GROUP BY plan_code,billing_cycle,status
  ORDER BY plan_code,billing_cycle,status
 `)).rows;

 const activeRows=subs.filter(x=>["ACTIVE","AUTHENTICATED"].includes(x.status));
 let mrr=0,activePaid=0;
 for(const row of activeRows){
  const monthly=monthlyRevenueInr(row.plan_code,row.billing_cycle);
  if(monthly!==null){mrr+=monthly*n(row.users);activePaid+=n(row.users)}
 }

 const churn=(await db.query(`
  SELECT
   count(*) FILTER (WHERE status='PAST_DUE')::int AS past_due,
   count(*) FILTER (WHERE status='PAUSED')::int AS paused,
   count(*) FILTER (WHERE status='CANCELLED' AND COALESCE(cancelled_at,updated_at)>=now()-interval '30 days')::int AS cancelled_30d,
   count(*) FILTER (WHERE cancel_at_period_end=true AND status NOT IN ('CANCELLED','COMPLETED','EXPIRED'))::int AS scheduled_cancellations
  FROM billing_subscriptions
 `)).rows[0];

 const usage=(await db.query(`
  SELECT
   count(*)::int AS events,
   COALESCE(sum(quota_units),0)::bigint AS quota_units,
   COALESCE(sum(input_tokens),0)::bigint AS input_tokens,
   COALESCE(sum(output_tokens),0)::bigint AS output_tokens,
   COALESCE(sum(estimated_cost_microusd) FILTER (WHERE priced),0)::bigint AS priced_cost_microusd,
   count(*) FILTER (WHERE priced)::int AS priced_events,
   count(*) FILTER (WHERE NOT priced)::int AS unpriced_events
  FROM usage_events
  WHERE source<>'benchmark' AND COALESCE(purpose,'') NOT LIKE 'benchmark:%' AND occurred_at>=date_trunc('month',now())
 `)).rows[0];

 const byPlan=(await db.query(`
  SELECT COALESCE(plan_code,'UNASSIGNED') AS plan_code,count(*)::int AS events,
         COALESCE(sum(quota_units),0)::bigint AS quota_units,
         COALESCE(sum(estimated_cost_microusd) FILTER (WHERE priced),0)::bigint AS priced_cost_microusd,
         count(*) FILTER (WHERE NOT priced)::int AS unpriced_events
  FROM usage_events
  WHERE source<>'benchmark' AND COALESCE(purpose,'') NOT LIKE 'benchmark:%' AND occurred_at>=date_trunc('month',now())
  GROUP BY COALESCE(plan_code,'UNASSIGNED')
  ORDER BY quota_units DESC
 `)).rows;

 const byType=(await db.query(`
  SELECT event_type,count(*)::int AS events,COALESCE(sum(quota_units),0)::bigint AS quota_units,
         COALESCE(sum(estimated_cost_microusd) FILTER (WHERE priced),0)::bigint AS priced_cost_microusd,
         count(*) FILTER (WHERE NOT priced)::int AS unpriced_events
  FROM usage_events
  WHERE source<>'benchmark' AND COALESCE(purpose,'') NOT LIKE 'benchmark:%' AND occurred_at>=date_trunc('month',now())
  GROUP BY event_type ORDER BY quota_units DESC
 `)).rows;

 const costly=(await db.query(`
  SELECT 'u_'||substr(md5(user_id),1,10) AS user_ref,
         COALESCE(max(plan_code),'UNASSIGNED') AS plan_code,
         count(*)::int AS events,
         COALESCE(sum(quota_units),0)::bigint AS quota_units,
         COALESCE(sum(estimated_cost_microusd) FILTER (WHERE priced),0)::bigint AS priced_cost_microusd,
         count(*) FILTER (WHERE NOT priced)::int AS unpriced_events
  FROM usage_events
  WHERE source<>'benchmark' AND COALESCE(purpose,'') NOT LIKE 'benchmark:%' AND occurred_at>=date_trunc('month',now())
  GROUP BY user_id
  ORDER BY priced_cost_microusd DESC,quota_units DESC
  LIMIT 20
 `)).rows;

 const totalUsers=n(known?.users);
 const conversion=totalUsers?activePaid/totalUsers*100:0;
 const priced=n(usage.priced_events),events=n(usage.events);
 const coverage=events?priced/events*100:0;

 return {
  generated_at:new Date().toISOString(),
  pricing_status:PRICING_STATUS,
  revenue:{currency:"INR",mrr_inr:round2(mrr),arr_inr:round2(mrr*12),active_paid_users:activePaid,arpu_inr:activePaid?round2(mrr/activePaid):0},
  users:{known_users:totalUsers,paid_conversion_percent:round2(conversion)},
  subscriptions:{breakdown:subs,past_due:n(churn.past_due),paused:n(churn.paused),cancelled_30d:n(churn.cancelled_30d),scheduled_cancellations:n(churn.scheduled_cancellations)},
  cost:{currency:"USD",priced_cost_microusd:n(usage.priced_cost_microusd),priced_cost_usd:round2(n(usage.priced_cost_microusd)/1000000),priced_events:priced,unpriced_events:n(usage.unpriced_events),cost_coverage_percent:round2(coverage)},
  margin:{status:"UNAVAILABLE_CURRENCY_MISMATCH",reason:"Revenue is tracked in INR while provider costs are tracked in USD. Configure a verified normalization basis before calculating gross margin."},
  usage:{month_quota_units:n(usage.quota_units),input_tokens:n(usage.input_tokens),output_tokens:n(usage.output_tokens),events,by_plan:byPlan,by_type:byType},
  high_usage_users:costly
 };
}