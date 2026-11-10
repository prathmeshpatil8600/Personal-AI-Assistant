import { db } from "hatchable";
import { requireAdminPortal } from "../../lib/admin-portal-auth.js";
export const access="user";
export const methods=["GET"];

const n=v=>Number(v||0);
const pct=(a,b)=>b>0?Math.round((a*1000)/b)/10:0;

async function windowMetrics(days){
 const interval=String(Math.max(1,Math.min(90,Number(days)||7)))+" days";
 const [runs,providers,lanes,opt,cost,active,purposes]=await Promise.all([
  db.query(`SELECT
    count(*)::int requests,
    COALESCE(sum(input_tokens),0)::bigint input_tokens,
    COALESCE(sum(output_tokens),0)::bigint output_tokens,
    COALESCE(sum(total_tokens),0)::bigint total_tokens,
    round(avg(input_tokens))::int avg_input_tokens,
    round(avg(output_tokens))::int avg_output_tokens,
    round(avg(latency_ms))::int avg_latency_ms,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms)::int p50_latency_ms,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)::int p95_latency_ms,
    count(*) FILTER (WHERE status='ERROR')::int errors,
    count(*) FILTER (WHERE fallback_used=true)::int fallbacks
   FROM ai_runs
   WHERE created_at>=now()-($1::interval) AND COALESCE(purpose,'') NOT LIKE 'benchmark:%'`,[interval]),
  db.query(`SELECT provider,count(*)::int requests,
    COALESCE(sum(input_tokens),0)::bigint input_tokens,
    COALESCE(sum(output_tokens),0)::bigint output_tokens,
    round(avg(latency_ms))::int avg_latency_ms,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms)::int p50_latency_ms,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)::int p95_latency_ms,
    count(*) FILTER (WHERE status='ERROR')::int errors
   FROM ai_runs
   WHERE created_at>=now()-($1::interval) AND COALESCE(purpose,'') NOT LIKE 'benchmark:%' AND provider IS NOT NULL
   GROUP BY provider ORDER BY requests DESC`,[interval]),
  db.query(`SELECT COALESCE(metadata->>'optimization_lane','UNKNOWN') lane,count(*)::int requests,
    COALESCE(sum(input_tokens),0)::bigint input_tokens,
    COALESCE(sum(output_tokens),0)::bigint output_tokens,
    COALESCE(sum(estimated_cost_microusd) FILTER (WHERE priced),0)::bigint cost_microusd
   FROM usage_events
   WHERE event_type='ai_generation' AND COALESCE(purpose,'') NOT LIKE 'benchmark:%' AND occurred_at>=now()-($1::interval)
   GROUP BY 1 ORDER BY requests DESC`,[interval]),
  db.query(`SELECT
    COALESCE(sum(deterministic_responses),0)::bigint deterministic_responses,
    COALESCE(sum(cache_hits),0)::bigint cache_hits,
    COALESCE(sum(cheap_model_runs),0)::bigint cheap_model_runs,
    COALESCE(sum(standard_model_runs),0)::bigint standard_model_runs,
    COALESCE(sum(messages_trimmed),0)::bigint messages_trimmed,
    COALESCE(sum(memories_injected),0)::bigint memories_injected,
    COALESCE(sum(tools_injected),0)::bigint tools_injected,
    COALESCE(sum(summary_updates),0)::bigint summary_updates,
    COALESCE(sum(estimated_input_tokens_saved),0)::bigint estimated_input_tokens_saved,
    COALESCE(sum(context_budget_hits),0)::bigint context_budget_hits
   FROM ai_optimization_daily
   WHERE metric_date>=CURRENT_DATE-($1::int-1)`,[Number(days)]),
  db.query(`SELECT
    count(*)::int events,
    COALESCE(sum(estimated_cost_microusd) FILTER (WHERE priced),0)::bigint cost_microusd,
    count(*) FILTER (WHERE priced)::int priced_events,
    count(*) FILTER (WHERE NOT priced)::int unpriced_events
   FROM usage_events
   WHERE event_type='ai_generation' AND COALESCE(purpose,'') NOT LIKE 'benchmark:%' AND occurred_at>=now()-($1::interval)`,[interval]),
  db.query(`SELECT count(DISTINCT user_id)::int active_users
   FROM usage_events WHERE event_type='ai_generation' AND COALESCE(purpose,'') NOT LIKE 'benchmark:%' AND occurred_at>=now()-($1::interval)`,[interval]),
  db.query(`SELECT COALESCE(purpose,'unknown') purpose,count(*)::int requests,
    round(avg(input_tokens))::int avg_input_tokens,
    round(avg(output_tokens))::int avg_output_tokens,
    round(avg(latency_ms))::int avg_latency_ms
   FROM ai_runs WHERE created_at>=now()-($1::interval) AND COALESCE(purpose,'') NOT LIKE 'benchmark:%'
   GROUP BY COALESCE(purpose,'unknown') ORDER BY requests DESC LIMIT 15`,[interval])
 ]);
 const r=runs.rows[0]||{},o=opt.rows[0]||{},c=cost.rows[0]||{},a=active.rows[0]||{};
 const requests=n(r.requests),input=n(r.input_tokens),saved=n(o.estimated_input_tokens_saved),activeUsers=n(a.active_users),costMicro=n(c.cost_microusd);
 const laneRows=lanes.rows.map(x=>({...x,share_percent:pct(n(x.requests),Math.max(1,n(c.events)))}));
 return {
  days:Number(days),
  requests,
  tokens:{
   input,
   output:n(r.output_tokens),
   total:n(r.total_tokens),
   avg_input:n(r.avg_input_tokens),
   avg_output:n(r.avg_output_tokens),
   estimated_input_saved:saved,
   estimated_without_optimization:input+saved,
   estimated_saved_percent:pct(saved,input+saved)
  },
  latency:{
   avg_ms:n(r.avg_latency_ms),
   p50_ms:n(r.p50_latency_ms),
   p95_ms:n(r.p95_latency_ms)
  },
  reliability:{
   errors:n(r.errors),
   error_rate_percent:pct(n(r.errors),requests),
   fallbacks:n(r.fallbacks),
   fallback_rate_percent:pct(n(r.fallbacks),requests)
  },
  cost:{
   microusd:costMicro,
   usd:costMicro/1e6,
   avg_usd_per_request:requests?costMicro/1e6/requests:0,
   active_users:activeUsers,
   usd_per_active_user:activeUsers?costMicro/1e6/activeUsers:0,
   priced_events:n(c.priced_events),
   unpriced_events:n(c.unpriced_events),
   coverage_percent:pct(n(c.priced_events),n(c.events))
  },
  optimization:{
   deterministic_responses:n(o.deterministic_responses),
   cache_hits:n(o.cache_hits),
   cheap_model_runs:n(o.cheap_model_runs),
   standard_model_runs:n(o.standard_model_runs),
   messages_trimmed:n(o.messages_trimmed),
   memories_injected:n(o.memories_injected),
   tools_injected:n(o.tools_injected),
   summary_updates:n(o.summary_updates),
   context_budget_hits:n(o.context_budget_hits),
   avg_memories_per_request:requests?Math.round(n(o.memories_injected)*100/requests)/100:0,
   avg_tools_per_request:requests?Math.round(n(o.tools_injected)*100/requests)/100:0
  },
  lanes:laneRows,
  providers:providers.rows,
  purposes:purposes.rows
 };
}

export default async function(req,res){
 const admin=requireAdminPortal(req,res);if(!admin)return;
 const [seven,thirty]=await Promise.all([windowMetrics(7),windowMetrics(30)]);
 const target={
  p50_latency_ms:2000,
  p95_latency_ms:10000,
  error_rate_percent:2,
  cheap_lane_share_percent:60,
  context_savings_percent:30
 };
 const cheap=seven.lanes.filter(x=>String(x.lane).startsWith("CHEAP")).reduce((s,x)=>s+n(x.requests),0);
 const cheapShare=pct(cheap,seven.requests);
 const checks=[
  {key:"p50_latency",ok:seven.latency.p50_ms<=target.p50_latency_ms,label:"P50 latency ≤ 2s",value:seven.latency.p50_ms,unit:"ms"},
  {key:"p95_latency",ok:seven.latency.p95_ms<=target.p95_latency_ms,label:"P95 latency ≤ 10s",value:seven.latency.p95_ms,unit:"ms"},
  {key:"error_rate",ok:seven.reliability.error_rate_percent<=target.error_rate_percent,label:"AI error rate ≤ 2%",value:seven.reliability.error_rate_percent,unit:"%"},
  {key:"cheap_share",ok:cheapShare>=target.cheap_lane_share_percent,label:"Cheap lane share ≥ 60%",value:cheapShare,unit:"%"},
  {key:"context_savings",ok:seven.tokens.estimated_saved_percent>=target.context_savings_percent||seven.optimization.context_budget_hits===0,label:"Context savings ≥ 30% when compaction is active",value:seven.tokens.estimated_saved_percent,unit:"%"}
 ];
 res.json({generated_at:new Date().toISOString(),seven_days:seven,thirty_days:thirty,targets:target,checks,overall:checks.every(x=>x.ok)?"HEALTHY":"REVIEW"});
}