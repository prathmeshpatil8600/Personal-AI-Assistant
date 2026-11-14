import { db } from "hatchable";
const pct=(a,b)=>Number(b)>0?Math.round(Number(a)*1000/Number(b))/10:0;

export async function computePilotMeasurement(cohort="PILOT_1"){
 const [p,u,o,f]=await Promise.all([
  db.query(`SELECT
   count(*) FILTER(WHERE status IN ('INVITED','ACTIVE'))::int cohort_size,
   count(*) FILTER(WHERE status='ACTIVE')::int active,
   count(*) FILTER(WHERE activated_at IS NOT NULL)::int activated,
   count(*) FILTER(WHERE activated_at IS NOT NULL AND now()>=activated_at+interval '1 day')::int d1_eligible,
   count(*) FILTER(WHERE activated_at IS NOT NULL AND now()>=activated_at+interval '1 day' AND last_seen_at>=activated_at+interval '1 day')::int d1_returned,
   count(*) FILTER(WHERE activated_at IS NOT NULL AND now()>=activated_at+interval '3 day')::int d3_eligible,
   count(*) FILTER(WHERE activated_at IS NOT NULL AND now()>=activated_at+interval '3 day' AND last_seen_at>=activated_at+interval '3 day')::int d3_returned,
   count(*) FILTER(WHERE activated_at IS NOT NULL AND now()>=activated_at+interval '7 day')::int d7_eligible,
   count(*) FILTER(WHERE activated_at IS NOT NULL AND now()>=activated_at+interval '7 day' AND last_seen_at>=activated_at+interval '7 day')::int d7_returned
   FROM pilot_participants WHERE cohort=$1`,[cohort]),
  db.query(`SELECT count(e.id)::int requests,
   COALESCE(sum(e.quota_units),0)::bigint units,
   COALESCE(sum(e.estimated_cost_microusd) FILTER(WHERE e.priced),0)::bigint cost
   FROM usage_events e JOIN pilot_participants p ON p.user_id=e.user_id
   WHERE p.cohort=$1 AND e.event_type='ai_generation'
    AND e.source<>'benchmark' AND COALESCE(e.purpose,'') NOT LIKE 'benchmark:%'
    AND e.occurred_at>=now()-interval '7 days'`,[cohort]),
  db.query(`SELECT
   count(*) FILTER(WHERE o.first_chat_at IS NOT NULL)::int first_chat,
   count(*) FILTER(WHERE o.status='COMPLETED')::int completed
   FROM user_onboarding o JOIN pilot_participants p ON p.user_id=o.user_id WHERE p.cohort=$1`,[cohort]),
  db.query(`SELECT
   count(*) FILTER(WHERE f.severity='CRITICAL' AND f.status IN ('OPEN','TRIAGED'))::int critical,
   count(*) FILTER(WHERE f.severity='HIGH' AND f.status IN ('OPEN','TRIAGED'))::int high
   FROM pilot_feedback f JOIN pilot_participants p ON p.user_id=f.user_id WHERE p.cohort=$1`,[cohort])
 ]);
 const ps=p.rows[0]||{},us=u.rows[0]||{},os=o.rows[0]||{},fs=f.rows[0]||{};
 const active=Number(ps.active||0),activated=Number(ps.activated||0),requests=Number(us.requests||0);
 const metrics={
  cohort_size:Number(ps.cohort_size||0),active,activated,
  requests_7d:requests,units_7d:Number(us.units||0),ai_cost_microusd_7d:Number(us.cost||0),
  avg_requests_per_active_user:active?Math.round(requests*100/active)/100:0,
  first_chat_percent:pct(os.first_chat,activated),onboarding_percent:pct(os.completed,activated),
  d1_eligible:Number(ps.d1_eligible||0),d1_returned:Number(ps.d1_returned||0),d1_percent:pct(ps.d1_returned,ps.d1_eligible),
  d3_eligible:Number(ps.d3_eligible||0),d3_returned:Number(ps.d3_returned||0),d3_percent:pct(ps.d3_returned,ps.d3_eligible),
  d7_eligible:Number(ps.d7_eligible||0),d7_returned:Number(ps.d7_returned||0),d7_percent:pct(ps.d7_returned,ps.d7_eligible),
  critical_open:Number(fs.critical||0),high_open:Number(fs.high||0)
 };
 let recommendation="COLLECT_DATA",reason="Keep the first cohort at five users until Day-7 data is mature.";
 if(metrics.critical_open>0||metrics.high_open>=3){recommendation="PAUSE";reason="Resolve severe pilot feedback before adding users."}
 else if(metrics.cohort_size<5){recommendation="FILL_TO_5";reason="Add only enough eligible testers to reach five participants."}
 else if(metrics.d7_eligible>=3&&metrics.d7_percent>=40&&metrics.first_chat_percent>=70&&metrics.onboarding_percent>=50){recommendation="EXPAND_TO_10";reason="Day-7 retention and activation are healthy enough for the next wave."}
 else if(metrics.d7_eligible>=3){recommendation="HOLD_AT_5";reason="Day-7 data is mature but retention or activation is below the expansion gate."}
 return {cohort,recommendation,reason,metrics,generated_at:new Date().toISOString()};
}

export async function savePilotMeasurement(cohort="PILOT_1"){
 const x=await computePilotMeasurement(cohort),m=x.metrics;
 await db.query(`INSERT INTO pilot_measurement_daily(
  snapshot_date,cohort,active_users,requests_7d,units_7d,ai_cost_microusd_7d,
  d1_percent,d3_percent,d7_percent,first_chat_percent,onboarding_percent,
  avg_requests_per_active_user,recommendation,metrics
 ) VALUES(CURRENT_DATE,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
 ON CONFLICT(snapshot_date) DO UPDATE SET
  active_users=EXCLUDED.active_users,requests_7d=EXCLUDED.requests_7d,units_7d=EXCLUDED.units_7d,
  ai_cost_microusd_7d=EXCLUDED.ai_cost_microusd_7d,d1_percent=EXCLUDED.d1_percent,
  d3_percent=EXCLUDED.d3_percent,d7_percent=EXCLUDED.d7_percent,
  first_chat_percent=EXCLUDED.first_chat_percent,onboarding_percent=EXCLUDED.onboarding_percent,
  avg_requests_per_active_user=EXCLUDED.avg_requests_per_active_user,
  recommendation=EXCLUDED.recommendation,metrics=EXCLUDED.metrics,updated_at=now()`,[
   cohort,m.active,m.requests_7d,m.units_7d,m.ai_cost_microusd_7d,
   m.d1_percent,m.d3_percent,m.d7_percent,m.first_chat_percent,m.onboarding_percent,
   m.avg_requests_per_active_user,x.recommendation,JSON.stringify(m)
  ]);
 return x;
}