import { db, config } from "hatchable";
export const access="admin";
export const methods=["GET"];

async function configured(name){
 try{return Boolean(process.env[name]||await config.get(name))}catch{return false}
}
async function tableExists(name){
 try{
  if(name==="pilot_feedback")await db.query("SELECT 1 FROM pilot_feedback LIMIT 1");
  else if(name==="account_deletion_requests")await db.query("SELECT 1 FROM account_deletion_requests LIMIT 1");
  else return false;
  return true;
 }catch{return false}
}

export default async function(req,res){
 const [
  aiRuns,criticalFeedback,openIncidents,heartbeatRows,
  razorpayId,razorpaySecret,plusM,plusA,proM,proA,
  googleClient,googleSecret,googleEnc,githubClient,githubSecret,githubEnc,
  feedbackTable,privacyTable,googleAi,groqAi
 ]=await Promise.all([
  db.query("SELECT count(*)::int AS n FROM ai_runs WHERE status='ERROR' AND created_at>=now()-interval '24 hours'"),
  db.query("SELECT count(*)::int AS n FROM pilot_feedback WHERE status IN ('OPEN','TRIAGED') AND severity='CRITICAL'").catch(()=>({rows:[{n:0}]})),
  db.query("SELECT count(*)::int AS n FROM operational_incidents WHERE resolved_at IS NULL AND severity IN ('ERROR','CRITICAL')"),
  db.query("SELECT job_key,last_succeeded_at,last_failed_at,consecutive_failures FROM operational_job_heartbeats"),
  configured("RAZORPAY_KEY_ID"),configured("RAZORPAY_KEY_SECRET"),
  configured("RAZORPAY_PLAN_PLUS_MONTHLY"),configured("RAZORPAY_PLAN_PLUS_ANNUAL"),
  configured("RAZORPAY_PLAN_PRO_MONTHLY"),configured("RAZORPAY_PLAN_PRO_ANNUAL"),
  configured("GOOGLE_OAUTH_CLIENT_ID"),configured("GOOGLE_OAUTH_CLIENT_SECRET"),configured("GOOGLE_OAUTH_ENCRYPTION_KEY"),
  configured("GITHUB_CLIENT_ID"),configured("GITHUB_CLIENT_SECRET"),configured("GITHUB_OAUTH_ENCRYPTION_KEY"),
  tableExists("pilot_feedback"),tableExists("account_deletion_requests"),
  configured("GOOGLE_API_KEY"),configured("GROQ_API_KEY")
 ]);
 const now=Date.now();
 const requiredJobs=["hourly_reminders","daily_stats","daily_briefing","weekly_review","business_snapshot","ai_cache_cleanup","billing_reconcile","addon_reconcile"];
 const heartbeats=Object.fromEntries(heartbeatRows.rows.map(x=>[x.job_key,x]));
 const jobChecks=requiredJobs.map(key=>{
  const j=heartbeats[key];
  const maxAgeMs=key==="weekly_review"?9*24*3600e3:key==="daily_briefing"||key==="daily_stats"||key==="business_snapshot"||key==="ai_cache_cleanup"?48*3600e3:3*3600e3;
  const observed=Boolean(j?.last_succeeded_at);
  const stale=observed&&(now-new Date(j.last_succeeded_at).getTime()>maxAgeMs);
  const failed=Number(j?.consecutive_failures||0)>0;
  return {job:key,ok:!failed,observed,stale,last_succeeded_at:j?.last_succeeded_at||null,last_failed_at:j?.last_failed_at||null,consecutive_failures:Number(j?.consecutive_failures||0)};
 });
 const coreChecks=[
  {key:"ai_provider",ok:googleAi||groqAi,label:"At least one AI provider configured"},
  {key:"privacy_lifecycle",ok:privacyTable,label:"Privacy/account lifecycle schema available"},
  {key:"pilot_feedback",ok:feedbackTable,label:"Pilot feedback channel available"},
  {key:"critical_feedback",ok:Number(criticalFeedback.rows[0]?.n||0)===0,label:"No unresolved critical pilot feedback"},
  {key:"operational_incidents",ok:Number(openIncidents.rows[0]?.n||0)===0,label:"No unresolved error/critical operational incidents"},
  {key:"ai_errors",ok:Number(aiRuns.rows[0]?.n||0)<10,label:"AI errors below pilot stop threshold"},
  ...jobChecks.map(j=>({key:"job:"+j.job,ok:j.ok,label:j.job+" has no recorded consecutive failures",detail:j}))
 ];
 const integrationChecks=[
  {key:"google_oauth",ok:googleClient&&googleSecret&&googleEnc,label:"Google OAuth fully configured"},
  {key:"github_oauth",ok:githubClient&&githubSecret&&githubEnc,label:"GitHub OAuth fully configured"}
 ];
 const billingChecks=[
  {key:"razorpay_credentials",ok:razorpayId&&razorpaySecret,label:"Razorpay credentials configured"},
  {key:"razorpay_plans",ok:plusM&&plusA&&proM&&proA,label:"All four Razorpay subscription plans configured"}
 ];
 const manualPublic=[
  {key:"project_visibility",ok:false,label:"Switch Hatchable visibility to Public only after closed-pilot approval",manual:true},
  {key:"legal_identity",ok:false,label:"Finalize operator identity, privacy/grievance/support contacts and legal review",manual:true},
  {key:"database_recovery",ok:false,label:"Confirm production database backup/restore procedure",manual:true},
  {key:"platform_identity_deletion",ok:false,label:"Document Hatchable end-user identity deletion procedure",manual:true}
 ];
 const pilotChecks=[...coreChecks,...integrationChecks];
 const publicChecks=[...pilotChecks,...billingChecks,...manualPublic];
 const pilotBlockers=pilotChecks.filter(x=>!x.ok);
 const publicBlockers=publicChecks.filter(x=>!x.ok);
 const warnings=jobChecks.filter(j=>!j.observed||j.stale).map(j=>({key:"job:"+j.job,label:!j.observed?j.job+" heartbeat not yet observed in this draft":j.job+" heartbeat is stale in this draft",detail:j}));
 res.json({
  generated_at:new Date().toISOString(),
  closed_pilot:{go:pilotBlockers.length===0,blockers:pilotBlockers,warnings,checks:pilotChecks},
  public_launch:{go:publicBlockers.length===0,blockers:publicBlockers,warnings,checks:publicChecks},
  note:"Closed pilot may remain free and private. Job-heartbeat freshness is advisory until the draft is promoted; recorded consecutive failures are blocking. Commercial/public launch additionally requires billing and manual legal/platform gates."
 });
}