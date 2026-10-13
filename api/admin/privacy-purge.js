import { db, storage } from "hatchable";
import { revokeGoogleAuthorization } from "../../lib/google-oauth.js";
import { revokeGithubAuthorization } from "../../lib/github-oauth.js";
export const access="admin";
export const methods=["POST"];

export default async function(req,res){
 const uid=String(req.body?.user_id||"").trim();
 if(!uid)return res.status(400).json({error:"user_id is required"});
 const request=(await db.query("SELECT * FROM account_deletion_requests WHERE user_id=$1 LIMIT 1",[uid])).rows[0];
 if(!request||request.status!=="REQUESTED")return res.status(409).json({error:"eligible_deletion_request_required"});
 if(new Date(request.execute_after).getTime()>Date.now())return res.status(409).json({error:"grace_period_active",execute_after:request.execute_after});
 const owned=(await db.query("SELECT id,name FROM organizations WHERE owner_user_id=$1 AND status='ACTIVE' LIMIT 20",[uid])).rows;
 if(owned.length)return res.status(409).json({error:"owned_organizations_must_be_transferred",organizations:owned});
 const sub=(await db.query("SELECT status FROM billing_subscriptions WHERE user_id=$1 LIMIT 1",[uid])).rows[0];
 if(sub&&!["CANCELLED","COMPLETED","EXPIRED"].includes(sub.status))return res.status(409).json({error:"active_subscription_must_be_resolved",status:sub.status});

 try{await revokeGoogleAuthorization(uid)}catch{}
 try{await revokeGithubAuthorization(uid)}catch{}

 const docs=(await db.query("SELECT storage_key FROM documents WHERE user_id=$1",[uid])).rows;
 for(const d of docs){if(d.storage_key)await storage.del(d.storage_key).catch(()=>{})}

 const anon="deleted:"+crypto.randomUUID();

 await db.query("UPDATE organization_memberships SET status='REMOVED',updated_at=now() WHERE user_id=$1 AND role<>'OWNER'",[uid]);
 await db.query("UPDATE organization_invites SET created_by=$2 WHERE created_by=$1",[uid,anon]).catch(()=>{});
 await db.query("UPDATE organization_invites SET accepted_by=$2 WHERE accepted_by=$1",[uid,anon]).catch(()=>{});
 await db.query("UPDATE organization_shared_items SET created_by=$2 WHERE created_by=$1",[uid,anon]).catch(()=>{});
 await db.query("UPDATE organization_shared_items SET updated_by=$2 WHERE updated_by=$1",[uid,anon]).catch(()=>{});
 await db.query("UPDATE organization_audit_log SET actor_user_id=$2 WHERE actor_user_id=$1",[uid,anon]).catch(()=>{});
 await db.query("UPDATE billing_subscriptions SET user_id=$2,metadata=metadata||jsonb_build_object('account_deleted_at',now()),updated_at=now() WHERE user_id=$1",[uid,anon]).catch(()=>{});
 await db.query("UPDATE billing_events SET user_id=$2 WHERE user_id=$1",[uid,anon]).catch(()=>{});
 await db.query("UPDATE addon_orders SET user_id=$2 WHERE user_id=$1",[uid,anon]).catch(()=>{});

 const tables=[
  "conversation_messages","conversations","document_vectors","document_chunks","documents",
  "habit_completions","habits","goals","assistant_notifications","calendar_events","reminders","notes","tasks",
  "memories","productivity_daily","tool_approvals","tool_runs","ai_runs","mcp_tool_registry","mcp_connections",
  "google_oauth_states","google_connections","github_oauth_states","github_connections","usage_events",
  "user_plan_assignments","addon_grants","developer_api_keys","referral_attributions","ai_response_cache",
  "ai_optimization_daily","user_rate_limits","user_preferences"
 ];
 const deleted={};
 for(const table of tables){
  try{const q=await db.query("DELETE FROM "+table+" WHERE user_id=$1 RETURNING 1",[uid]);deleted[table]=q.rowCount||0}catch{deleted[table]=0}
 }
 await db.query("UPDATE privacy_consents SET user_id=$2 WHERE user_id=$1",[uid,anon]).catch(()=>{});
 await db.query("UPDATE privacy_grievances SET user_id=$2 WHERE user_id=$1",[uid,anon]).catch(()=>{});
 await db.query("UPDATE account_deletion_requests SET status='APP_DATA_DELETED',completed_at=now(),blockers='[]'::jsonb,metadata=metadata||jsonb_build_object('anonymized_user_ref',$2,'platform_identity_deletion_required',true),updated_at=now() WHERE user_id=$1",[uid,anon]);
 res.json({ok:true,status:"APP_DATA_DELETED",deleted,provider_authorizations_revoked:true,platform_identity_deletion_required:true});
}