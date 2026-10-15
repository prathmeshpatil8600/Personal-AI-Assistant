import { db, config } from "hatchable";
export const access="admin";
export const methods=["GET"];
async function cfg(name){try{return Boolean(process.env[name]||await config.get(name))}catch{return false}}
async function probe(sql){try{await db.query(sql);return true}catch{return false}}
export default async function(req,res){
 const [users,privacy,feedback,pilot,onboarding,review,aiGoogle,aiGroq,critical,incidents]=await Promise.all([
  probe("SELECT 1 FROM users LIMIT 1"),
  probe("SELECT 1 FROM account_deletion_requests LIMIT 1"),
  probe("SELECT 1 FROM pilot_feedback LIMIT 1"),
  probe("SELECT 1 FROM pilot_participants LIMIT 1"),
  probe("SELECT 1 FROM user_onboarding LIMIT 1"),
  probe("SELECT 1 FROM pilot_review_snapshots LIMIT 1"),
  cfg("GOOGLE_API_KEY"),cfg("GROQ_API_KEY"),
  db.query("SELECT count(*)::int n FROM pilot_feedback WHERE severity='CRITICAL' AND status IN ('OPEN','TRIAGED')"),
  db.query("SELECT count(*)::int n FROM operational_incidents WHERE severity IN ('ERROR','CRITICAL') AND resolved_at IS NULL")
 ]);
 const checks=[
  {key:"database",ok:users,label:"Core database reachable"},
  {key:"privacy",ok:privacy,label:"Privacy lifecycle available"},
  {key:"feedback",ok:feedback,label:"Pilot feedback available"},
  {key:"participants",ok:pilot,label:"Pilot cohort controls available"},
  {key:"onboarding",ok:onboarding,label:"Pilot onboarding telemetry available"},
  {key:"reviews",ok:review,label:"Pilot review snapshots available"},
  {key:"ai_provider",ok:aiGoogle||aiGroq,label:"At least one AI provider configured"},
  {key:"critical_feedback",ok:Number(critical.rows[0]?.n||0)===0,label:"No unresolved critical feedback"},
  {key:"operational_incidents",ok:Number(incidents.rows[0]?.n||0)===0,label:"No open error/critical incident"}
 ];
 const blockers=checks.filter(x=>!x.ok);
 res.json({ok:blockers.length===0,generated_at:new Date().toISOString(),checks,blockers});
}