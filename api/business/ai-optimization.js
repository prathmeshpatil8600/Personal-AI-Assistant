import { db } from "hatchable";
export const access="admin";
export const methods=["GET"];
export default async function(req,res){
 const days=Math.max(1,Math.min(90,Number.parseInt(req.query?.days,10)||30));
 const telemetry=(await db.query(`
  SELECT
   COALESCE(sum(deterministic_responses),0)::bigint AS deterministic_responses,
   COALESCE(sum(cache_hits),0)::bigint AS cache_hits,
   COALESCE(sum(cheap_model_runs),0)::bigint AS cheap_model_runs,
   COALESCE(sum(standard_model_runs),0)::bigint AS standard_model_runs,
   COALESCE(sum(messages_trimmed),0)::bigint AS messages_trimmed,
   COALESCE(sum(memories_injected),0)::bigint AS memories_injected,
   COALESCE(sum(tools_injected),0)::bigint AS tools_injected
  FROM ai_optimization_daily
  WHERE metric_date>=CURRENT_DATE-$1::int
 `,[days])).rows[0];
 const routed=(await db.query(`
  SELECT COALESCE(metadata->>'optimization_lane','LEGACY') AS lane,
         COALESCE(model,'unknown') AS model,
         count(*)::int AS calls,
         COALESCE(sum(input_tokens),0)::bigint AS input_tokens,
         COALESCE(sum(output_tokens),0)::bigint AS output_tokens,
         COALESCE(avg(COALESCE(input_tokens,0)+COALESCE(output_tokens,0)),0)::numeric(12,2) AS avg_total_tokens,
         COALESCE(sum(quota_units),0)::bigint AS credits,
         COALESCE(sum(estimated_cost_microusd) FILTER(WHERE priced),0)::bigint AS priced_cost_microusd,
         count(*) FILTER(WHERE NOT priced)::int AS unpriced_calls
  FROM usage_events
  WHERE event_type='ai_generation' AND occurred_at>=now()-($1::int*interval '1 day')
  GROUP BY COALESCE(metadata->>'optimization_lane','LEGACY'),COALESCE(model,'unknown')
  ORDER BY calls DESC
 `,[days])).rows;
 const cache=(await db.query("SELECT count(*)::int AS live_entries,COALESCE(sum(hit_count),0)::bigint AS lifetime_hits FROM ai_response_cache WHERE expires_at>now()")).rows[0];
 const avoided=Number(telemetry?.deterministic_responses||0)+Number(telemetry?.cache_hits||0);
 res.json({
  days,
  telemetry,
  avoided_model_calls:avoided,
  model_mix:routed,
  cache,
  interpretation:{
   avoided_model_calls:"Deterministic responses plus valid cache hits that avoided a new generation call.",
   legacy_lane:"AI events recorded before optimization-lane telemetry was introduced.",
   cost_note:"Use B1 configured provider rate cards before treating priced cost as complete."
  }
 });
}