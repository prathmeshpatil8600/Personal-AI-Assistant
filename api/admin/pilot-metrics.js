import { db } from "hatchable";
export const access="admin";
export const methods=["GET"];

export default async function(req,res){
 const [
  participants,onboarding,usage,latency,feedback,retention,activation,incidents
 ]=await Promise.all([
  db.query("SELECT status,count(*)::int n FROM pilot_participants GROUP BY status"),
  db.query("SELECT status,count(*)::int n FROM user_onboarding GROUP BY status"),
  db.query(`SELECT count(DISTINCT user_id)::int active_users_7d,COALESCE(sum(quota_units),0)::bigint units_7d,
   COALESCE(sum(estimated_cost_microusd) FILTER (WHERE priced),0)::bigint cost_microusd_7d
   FROM usage_events WHERE occurred_at>=now()-interval '7 days'`),
  db.query(`SELECT provider,count(*)::int runs,
   round(avg(latency_ms))::int avg_latency_ms,
   percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms)::int p50_latency_ms,
   percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)::int p95_latency_ms,
   count(*) FILTER (WHERE status='ERROR')::int errors
   FROM ai_runs WHERE created_at>=now()-interval '7 days' AND latency_ms IS NOT NULL GROUP BY provider`),
  db.query("SELECT severity,status,count(*)::int n FROM pilot_feedback GROUP BY severity,status"),
  db.query(`
   SELECT
    count(*) FILTER (WHERE activated_at IS NOT NULL)::int activated,
    count(*) FILTER (WHERE activated_at IS NOT NULL AND last_seen_at>=activated_at+interval '1 day')::int returned_d1,
    count(*) FILTER (WHERE activated_at IS NOT NULL AND last_seen_at>=activated_at+interval '7 days')::int returned_d7
   FROM pilot_participants WHERE status IN ('ACTIVE','PAUSED','REMOVED')`),
  db.query(`
   SELECT
    count(*) FILTER (WHERE p.status IN ('INVITED','ACTIVE','PAUSED','REMOVED'))::int invited,
    count(*) FILTER (WHERE p.activated_at IS NOT NULL)::int activated,
    count(*) FILTER (WHERE o.first_chat_at IS NOT NULL)::int first_chat,
    count(*) FILTER (WHERE o.status='COMPLETED')::int onboarding_completed
   FROM pilot_participants p LEFT JOIN user_onboarding o ON o.user_id=p.user_id`),
  db.query("SELECT count(*)::int n FROM operational_incidents WHERE resolved_at IS NULL AND severity IN ('ERROR','CRITICAL')")
 ]);
 const u=usage.rows[0]||{};
 const active=Math.max(0,Number(u.active_users_7d||0));
 const costMicro=Number(u.cost_microusd_7d||0);
 const costPerActiveMicro=active?Math.round(costMicro/active):0;
 const crit=(feedback.rows||[]).filter(x=>x.severity==="CRITICAL"&&["OPEN","TRIAGED"].includes(x.status)).reduce((a,x)=>a+Number(x.n||0),0);
 const highOpen=(feedback.rows||[]).filter(x=>x.severity==="HIGH"&&["OPEN","TRIAGED"].includes(x.status)).reduce((a,x)=>a+Number(x.n||0),0);
 const google=(latency.rows||[]).find(x=>x.provider==="google");
 const groq=(latency.rows||[]).find(x=>x.provider==="groq");
 const stopConditions=[
  {key:"critical_feedback",stop:crit>0,label:"Unresolved critical pilot feedback",value:crit,threshold:0},
  {key:"open_high_feedback",stop:highOpen>=3,label:"Three or more unresolved high-severity issues",value:highOpen,threshold:3},
  {key:"operational_incidents",stop:Number(incidents.rows[0]?.n||0)>0,label:"Open ERROR/CRITICAL operational incident",value:Number(incidents.rows[0]?.n||0),threshold:0},
  {key:"google_p95_latency",stop:Number(google?.p95_latency_ms||0)>60000,label:"Google P95 AI latency above 60s",value:Number(google?.p95_latency_ms||0),threshold:60000},
  {key:"groq_p50_latency",stop:Number(groq?.p50_latency_ms||0)>30000,label:"Groq median fallback latency above 30s",value:Number(groq?.p50_latency_ms||0),threshold:30000},
  {key:"cost_per_active_user",stop:costPerActiveMicro>500000,label:"7-day AI cost per active user above $0.50",value:costPerActiveMicro,threshold:500000}
 ];
 const stop=stopConditions.some(x=>x.stop);
 const ret=retention.rows[0]||{},act=activation.rows[0]||{};
 const pct=(a,b)=>Number(b)>0?Math.round(Number(a)*1000/Number(b))/10:0;
 res.json({
  generated_at:new Date().toISOString(),
  pilot_status:stop?"PAUSE_AND_REVIEW":"CONTINUE",
  stop_conditions:stopConditions,
  participants:participants.rows,
  onboarding:onboarding.rows,
  activation:{
    invited:Number(act.invited||0),activated:Number(act.activated||0),first_chat:Number(act.first_chat||0),onboarding_completed:Number(act.onboarding_completed||0),
    activation_rate_percent:pct(act.activated,act.invited),
    first_chat_rate_percent:pct(act.first_chat,act.activated),
    onboarding_completion_percent:pct(act.onboarding_completed,act.activated)
  },
  retention:{
    activated:Number(ret.activated||0),returned_d1:Number(ret.returned_d1||0),returned_d7:Number(ret.returned_d7||0),
    d1_percent:pct(ret.returned_d1,ret.activated),d7_percent:pct(ret.returned_d7,ret.activated)
  },
  usage:{...u,cost_per_active_user_microusd:costPerActiveMicro,cost_per_active_user_usd:costPerActiveMicro/1000000},
  ai_latency:latency.rows,
  feedback:feedback.rows
 });
}