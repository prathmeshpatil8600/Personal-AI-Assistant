import { db } from "hatchable";
import { requireAdminPortal } from "../../lib/admin-portal-auth.js";
import { computeBusinessMetrics } from "../../lib/business-metrics.js";
import { computePilotReview } from "../../lib/pilot-review.js";
export const access="user";
export const methods=["GET"];

export default async function(req,res){
 const admin=requireAdminPortal(req,res);if(!admin)return;
 const [business,pilot,users,feedback,incidents,jobs,deletions,grievances]=await Promise.all([
  computeBusinessMetrics(),
  computePilotReview("PILOT_1"),
  db.query("SELECT count(*)::int total,count(*) FILTER (WHERE created_at>=now()-interval '7 days')::int new_7d FROM users"),
  db.query("SELECT severity,status,count(*)::int n FROM pilot_feedback GROUP BY severity,status").catch(()=>({rows:[]})),
  db.query("SELECT severity,count(*)::int n FROM operational_incidents WHERE resolved_at IS NULL GROUP BY severity"),
  db.query("SELECT job_key,last_succeeded_at,last_failed_at,consecutive_failures,last_error FROM operational_job_heartbeats ORDER BY job_key"),
  db.query("SELECT status,count(*)::int n FROM account_deletion_requests GROUP BY status").catch(()=>({rows:[]})),
  db.query("SELECT status,count(*)::int n FROM privacy_grievances GROUP BY status").catch(()=>({rows:[]}))
 ]);
 res.json({
  generated_at:new Date().toISOString(),
  users:users.rows[0]||{total:0,new_7d:0},
  pilot,
  business:{
   revenue:business.revenue,
   users:business.users,
   cost:business.cost,
   margin:business.margin,
   subscriptions:business.subscriptions,
   usage:business.usage
  },
  feedback:feedback.rows,
  incidents:incidents.rows,
  jobs:jobs.rows,
  privacy:{deletions:deletions.rows,grievances:grievances.rows}
 });
}