import { db,config } from "hatchable";

async function configured(name){try{return Boolean(process.env[name]||await config.get(name))}catch{return false}}
async function exists(sql){try{await db.query(sql);return true}catch{return false}}

export async function computeLaunchGate(){
 const [
  googleAi,groqAi,googleClient,googleSecret,googleEnc,githubClient,githubSecret,githubEnc,
  razorId,razorSecret,plusM,plusA,proM,proA,
  critical,incidents,aiErrors,jobs,privacySchema,pilotSchema,latestDecision,manual
 ]=await Promise.all([
  configured("GOOGLE_API_KEY"),configured("GROQ_API_KEY"),
  configured("GOOGLE_OAUTH_CLIENT_ID"),configured("GOOGLE_OAUTH_CLIENT_SECRET"),configured("GOOGLE_OAUTH_ENCRYPTION_KEY"),
  configured("GITHUB_CLIENT_ID"),configured("GITHUB_CLIENT_SECRET"),configured("GITHUB_OAUTH_ENCRYPTION_KEY"),
  configured("RAZORPAY_KEY_ID"),configured("RAZORPAY_KEY_SECRET"),
  configured("RAZORPAY_PLAN_PLUS_MONTHLY"),configured("RAZORPAY_PLAN_PLUS_ANNUAL"),configured("RAZORPAY_PLAN_PRO_MONTHLY"),configured("RAZORPAY_PLAN_PRO_ANNUAL"),
  db.query("SELECT count(*)::int n FROM pilot_feedback WHERE severity='CRITICAL' AND status IN ('OPEN','TRIAGED')").catch(()=>({rows:[{n:0}]})),
  db.query("SELECT count(*)::int n FROM operational_incidents WHERE resolved_at IS NULL AND severity IN ('ERROR','CRITICAL')"),
  db.query("SELECT count(*)::int n FROM ai_runs WHERE status='ERROR' AND created_at>=now()-interval '24 hours'"),
  db.query("SELECT job_key,last_succeeded_at,consecutive_failures,last_error FROM operational_job_heartbeats"),
  exists("SELECT 1 FROM account_deletion_requests LIMIT 1"),
  exists("SELECT 1 FROM pilot_measurement_daily LIMIT 1"),
  db.query("SELECT cohort_decision,confidence,decision_date,created_at FROM pilot_pricing_decisions ORDER BY created_at DESC LIMIT 1").catch(()=>({rows:[]})),
  db.query("SELECT check_key,label,confirmed,note,confirmed_by,confirmed_at,updated_at FROM launch_manual_checks ORDER BY check_key").catch(()=>({rows:[]}))
 ]);

 const requiredJobs=["hourly_reminders","daily_stats","daily_briefing","weekly_review","business_snapshot","ai_cache_cleanup","billing_reconcile","addon_reconcile","unit_economics_snapshot","pilot_measurement_snapshot","pilot_decision_snapshot"];
 const byJob=Object.fromEntries(jobs.rows.map(x=>[x.job_key,x]));
 const jobChecks=requiredJobs.map(key=>{
  const j=byJob[key];
  return {key:"job:"+key,label:key+" scheduler healthy",ok:Boolean(j?.last_succeeded_at)&&Number(j?.consecutive_failures||0)===0,detail:j||null};
 });

 const pd=latestDecision.rows[0]||null;
 const pilotValidated=Boolean(pd&&["EXPAND_TO_10"].includes(pd.cohort_decision)&&["MEDIUM","HIGH"].includes(pd.confidence));
 const automatic=[
  {key:"ai_provider",label:"At least one AI provider configured",ok:googleAi||groqAi},
  {key:"privacy_schema",label:"Privacy/account lifecycle available",ok:privacySchema},
  {key:"pilot_schema",label:"Pilot measurement system available",ok:pilotSchema},
  {key:"critical_feedback",label:"No unresolved Critical pilot feedback",ok:Number(critical.rows[0]?.n||0)===0},
  {key:"operational_incidents",label:"No unresolved Error/Critical incidents",ok:Number(incidents.rows[0]?.n||0)===0},
  {key:"ai_error_rate",label:"Fewer than 10 AI errors in last 24 hours",ok:Number(aiErrors.rows[0]?.n||0)<10},
  {key:"google_oauth",label:"Google OAuth production configuration present",ok:googleClient&&googleSecret&&googleEnc},
  {key:"github_oauth",label:"GitHub OAuth production configuration present",ok:githubClient&&githubSecret&&githubEnc},
  {key:"razorpay_credentials",label:"Razorpay production credentials configured",ok:razorId&&razorSecret},
  {key:"razorpay_plans",label:"Plus/Pro monthly and annual Razorpay plans configured",ok:plusM&&plusA&&proM&&proA},
  {key:"pilot_validation",label:"Pilot passed Day-7 expansion gate with sufficient confidence",ok:pilotValidated,detail:pd},
  ...jobChecks
 ];
 const manualChecks=manual.rows.map(x=>({...x,ok:Boolean(x.confirmed),manual:true}));
 const blockers=[...automatic.filter(x=>!x.ok),...manualChecks.filter(x=>!x.ok)];
 const automaticBlockers=automatic.filter(x=>!x.ok);
 const manualBlockers=manualChecks.filter(x=>!x.ok);
 return {
  generated_at:new Date().toISOString(),
  status:blockers.length===0?"GO":"NO_GO",
  automatic,manual:manualChecks,blockers,
  summary:{
   automatic_passed:automatic.length-automaticBlockers.length,
   automatic_total:automatic.length,
   manual_passed:manualChecks.length-manualBlockers.length,
   manual_total:manualChecks.length,
   blockers:blockers.length
  },
  final_action:blockers.length===0?"Promote the approved draft to Live and run the post-live smoke suite.":"Resolve every blocker before commercial launch."
 };
}