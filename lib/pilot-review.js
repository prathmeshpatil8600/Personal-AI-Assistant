import { db } from "hatchable";

const pct=(a,b)=>Number(b)>0?Math.round(Number(a)*1000/Number(b))/10:0;

export async function computePilotReview(cohort="PILOT_1"){
 const [p,o,u,a,f,i]=await Promise.all([
  db.query("SELECT count(*)::int invited,count(*) FILTER (WHERE activated_at IS NOT NULL)::int activated,count(*) FILTER (WHERE last_seen_at>=now()-interval '1 day')::int active_1d,count(*) FILTER (WHERE last_seen_at>=now()-interval '7 days')::int active_7d FROM pilot_participants WHERE cohort=$1 AND status IN ('INVITED','ACTIVE','PAUSED','REMOVED')",[cohort]),
  db.query("SELECT count(*) FILTER (WHERE u.status='COMPLETED')::int completed,count(*) FILTER (WHERE u.first_chat_at IS NOT NULL)::int first_chat FROM user_onboarding u JOIN pilot_participants p ON p.user_id=u.user_id WHERE p.cohort=$1",[cohort]),
  db.query(`SELECT COALESCE(sum(e.quota_units),0)::bigint units,COALESCE(sum(e.estimated_cost_microusd) FILTER (WHERE e.priced),0)::bigint cost
   FROM usage_events e JOIN pilot_participants p ON p.user_id=e.user_id
   WHERE p.cohort=$1 AND e.occurred_at>=now()-interval '7 days'`,[cohort]),
  db.query(`SELECT r.provider,percentile_cont(0.5) WITHIN GROUP (ORDER BY r.latency_ms)::int p50,
   percentile_cont(0.95) WITHIN GROUP (ORDER BY r.latency_ms)::int p95,count(*) FILTER (WHERE r.status='ERROR')::int errors
   FROM ai_runs r JOIN pilot_participants p ON p.user_id=r.user_id
   WHERE p.cohort=$1 AND r.created_at>=now()-interval '7 days' AND r.latency_ms IS NOT NULL GROUP BY r.provider`,[cohort]),
  db.query("SELECT f.severity,f.status,count(*)::int n FROM pilot_feedback f JOIN pilot_participants p ON p.user_id=f.user_id WHERE p.cohort=$1 GROUP BY f.severity,f.status",[cohort]),
  db.query("SELECT count(*)::int n FROM operational_incidents WHERE resolved_at IS NULL AND severity IN ('ERROR','CRITICAL')")
 ]);
 const ps=p.rows[0]||{},os=o.rows[0]||{},us=u.rows[0]||{};
 const activated=Number(ps.activated||0),invited=Number(ps.invited||0),active7=Number(ps.active_7d||0);
 const feedback=f.rows||[],lat=a.rows||[];
 const critical=feedback.filter(x=>x.severity==="CRITICAL"&&["OPEN","TRIAGED"].includes(x.status)).reduce((n,x)=>n+Number(x.n||0),0);
 const high=feedback.filter(x=>x.severity==="HIGH"&&["OPEN","TRIAGED"].includes(x.status)).reduce((n,x)=>n+Number(x.n||0),0);
 const google=lat.find(x=>x.provider==="google"),groq=lat.find(x=>x.provider==="groq");
 const costPerActive=active7?Math.round(Number(us.cost||0)/active7):0;
 const metrics={
  invited,activated,active_1d:Number(ps.active_1d||0),active_7d:active7,
  activation_rate_percent:pct(activated,invited),
  first_chat:Number(os.first_chat||0),first_chat_rate_percent:pct(os.first_chat,activated),
  onboarding_completed:Number(os.completed||0),onboarding_completion_percent:pct(os.completed,activated),
  units_7d:Number(us.units||0),cost_microusd_7d:Number(us.cost||0),cost_per_active_user_usd:costPerActive/1e6,
  google_p50_ms:Number(google?.p50||0),google_p95_ms:Number(google?.p95||0),
  groq_p50_ms:Number(groq?.p50||0),groq_p95_ms:Number(groq?.p95||0),
  critical_open:critical,high_open:high,operational_incidents:Number(i.rows[0]?.n||0)
 };
 const reasons=[];
 let recommendation="HOLD";
 if(critical>0||high>=3||metrics.operational_incidents>0||metrics.google_p95_ms>60000||metrics.groq_p50_ms>30000||costPerActive>500000){
  recommendation="PAUSE";reasons.push("A pilot stop condition is triggered.");
 }else if(activated===0){
  recommendation="HOLD";reasons.push("No real pilot participant has activated yet.");
 }else if(activated<5){
  recommendation="CONTINUE";reasons.push("Keep the first wave at up to 5 activated users while collecting initial behavior.");
 }else if(activated<10){
  if(metrics.first_chat_rate_percent>=70&&critical===0&&high<3){recommendation="EXPAND";reasons.push("Wave 1 activation is healthy enough to expand toward 10 users.");}
  else{recommendation="CONTINUE";reasons.push("Keep the current cohort until first-chat activation improves or issues are resolved.");}
 }else if(activated<20){
  if(metrics.first_chat_rate_percent>=70&&metrics.onboarding_completion_percent>=50&&critical===0&&high<3){recommendation="EXPAND";reasons.push("Activation and onboarding support expansion toward 20 users.");}
  else{recommendation="CONTINUE";reasons.push("Hold near the current cohort until onboarding/quality signals improve.");}
 }else{
  recommendation="CONTINUE";reasons.push("Do not expand beyond 20 until the Day-7 review and commercial launch gate are completed.");
 }
 return {cohort,recommendation,reasons,metrics,generated_at:new Date().toISOString()};
}

export async function savePilotReview({cohort="PILOT_1",checkpoint="DAILY"}={}){
 const review=await computePilotReview(cohort);
 const row=(await db.query(`INSERT INTO pilot_review_snapshots(review_date,cohort,checkpoint,recommendation,metrics,reasons)
 VALUES(CURRENT_DATE,$1,$2,$3,$4::jsonb,$5::jsonb)
 ON CONFLICT(review_date,cohort,checkpoint) DO UPDATE SET recommendation=EXCLUDED.recommendation,metrics=EXCLUDED.metrics,reasons=EXCLUDED.reasons,created_at=now()
 RETURNING *`,[cohort,checkpoint,review.recommendation,JSON.stringify(review.metrics),JSON.stringify(review.reasons)])).rows[0];
 return {...review,snapshot_id:row.id,review_date:row.review_date,checkpoint};
}