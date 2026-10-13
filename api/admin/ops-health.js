import { db, config } from "hatchable";
export const access="admin";
export const methods=["GET"];

async function configured(name){
  try{return Boolean(process.env[name]||await config.get(name))}catch{return false}
}

export default async function(req,res){
 const [jobs,aiErrors,aiFallbacks,openIncidents,billingRows,googleRows,githubRows,razorpayKey,razorpaySecret,groqKey,googleKey]=await Promise.all([
  db.query("SELECT job_key,last_started_at,last_succeeded_at,last_failed_at,consecutive_failures,last_error,last_result,updated_at FROM operational_job_heartbeats ORDER BY job_key"),
  db.query("SELECT count(*)::int AS n FROM ai_runs WHERE status='ERROR' AND created_at>=now()-interval '24 hours'"),
  db.query("SELECT count(*)::int AS n FROM ai_runs WHERE fallback_used=true AND created_at>=now()-interval '24 hours'"),
  db.query("SELECT id,source,severity,incident_key,message,created_at FROM operational_incidents WHERE resolved_at IS NULL ORDER BY created_at DESC LIMIT 50"),
  db.query("SELECT status,count(*)::int AS n FROM billing_subscriptions GROUP BY status ORDER BY status"),
  db.query("SELECT status,count(*)::int AS n FROM google_connections GROUP BY status ORDER BY status").catch(()=>({rows:[]})),
  db.query("SELECT status,count(*)::int AS n FROM github_connections GROUP BY status ORDER BY status").catch(()=>({rows:[]})),
  configured("RAZORPAY_KEY_ID"),configured("RAZORPAY_KEY_SECRET"),configured("GROQ_API_KEY"),configured("GOOGLE_API_KEY")
 ]);
 const now=Date.now();
 const jobHealth=jobs.rows.map(j=>({
   ...j,
   stale:!j.last_succeeded_at||now-new Date(j.last_succeeded_at).getTime()>48*60*60*1000,
   healthy:Number(j.consecutive_failures||0)===0&&Boolean(j.last_succeeded_at)
 }));
 const unhealthy=jobHealth.filter(j=>!j.healthy||j.stale);
 res.json({
  ok:unhealthy.length===0,
  generated_at:new Date().toISOString(),
  jobs:{total:jobHealth.length,unhealthy:unhealthy.length,items:jobHealth},
  ai:{errors_24h:Number(aiErrors.rows[0]?.n||0),fallbacks_24h:Number(aiFallbacks.rows[0]?.n||0),google_configured:googleKey,groq_configured:groqKey},
  billing:{razorpay_key_id:razorpayKey,razorpay_secret:razorpaySecret,subscriptions:billingRows.rows},
  integrations:{google:googleRows.rows,github:githubRows.rows},
  incidents:openIncidents.rows
 });
}