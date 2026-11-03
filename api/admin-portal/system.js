import { db,config } from "hatchable";
import { requireAdminPortal } from "../../lib/admin-portal-auth.js";
export const access="user";
export const methods=["GET","POST"];
async function configured(name){try{return Boolean(process.env[name]||await config.get(name))}catch{return false}}
export default async function(req,res){
 const admin=requireAdminPortal(req,res);if(!admin)return;
 if(req.method==="POST"){
  const action=String(req.body?.action||"");
  if(action==="resolve_incident"){
   const id=String(req.body?.id||"");
   const row=(await db.query("UPDATE operational_incidents SET resolved_at=now() WHERE id=$1 AND resolved_at IS NULL RETURNING id,resolved_at",[id])).rows[0];
   if(!row)return res.status(404).json({error:"incident_not_found"});
   return res.json(row);
  }
  return res.status(400).json({error:"invalid_action"});
 }
 const [jobs,incidents,aiErrors,aiFallbacks,billing,google,github,razorpayId,razorpaySecret,googleAi,groqAi]=await Promise.all([
  db.query("SELECT job_key,last_started_at,last_succeeded_at,last_failed_at,consecutive_failures,last_error,updated_at FROM operational_job_heartbeats ORDER BY job_key"),
  db.query("SELECT id,source,severity,incident_key,message,created_at FROM operational_incidents WHERE resolved_at IS NULL ORDER BY created_at DESC LIMIT 100"),
  db.query("SELECT count(*)::int n FROM ai_runs WHERE status='ERROR' AND created_at>=now()-interval '24 hours'"),
  db.query("SELECT count(*)::int n FROM ai_runs WHERE fallback_used=true AND created_at>=now()-interval '24 hours'"),
  db.query("SELECT status,count(*)::int n FROM billing_subscriptions GROUP BY status ORDER BY status"),
  db.query("SELECT status,count(*)::int n FROM google_connections GROUP BY status ORDER BY status").catch(()=>({rows:[]})),
  db.query("SELECT status,count(*)::int n FROM github_connections GROUP BY status ORDER BY status").catch(()=>({rows:[]})),
  configured("RAZORPAY_KEY_ID"),configured("RAZORPAY_KEY_SECRET"),configured("GOOGLE_API_KEY"),configured("GROQ_API_KEY")
 ]);
 res.json({generated_at:new Date().toISOString(),jobs:jobs.rows,incidents:incidents.rows,ai:{errors_24h:Number(aiErrors.rows[0]?.n||0),fallbacks_24h:Number(aiFallbacks.rows[0]?.n||0),google_configured:googleAi,groq_configured:groqAi},billing:{razorpay_key_id:razorpayId,razorpay_secret:razorpaySecret,subscriptions:billing.rows},integrations:{google:google.rows,github:github.rows}});
}