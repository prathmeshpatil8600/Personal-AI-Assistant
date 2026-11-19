import { db } from "hatchable";

const ROLE_RANK={MEMBER:1,BILLING:2,ADMIN:3,OWNER:4};

export function slugifyOrgName(name){
 const base=String(name||"").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,56);
 return base.length>=3?base:"team";
}
export function randomToken(){
 const bytes=crypto.getRandomValues(new Uint8Array(32));
 return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
}
export async function hashToken(token){
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(token)));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
}
async function orgMembership(userId,orgId){
 return (await db.query(`
  SELECT m.organization_id,m.user_id,m.role,m.status,o.name,o.slug,o.status AS organization_status,
         o.seat_limit,o.business_tier,o.entitlements,o.billing_status,o.trial_ends_at
  FROM organization_memberships m
  JOIN organizations o ON o.id=m.organization_id
  WHERE m.organization_id=$1 AND m.user_id=$2
  LIMIT 1
 `,[orgId,userId])).rows[0]||null;
}
export async function requireOrgRole(userId,orgId,minRole="MEMBER"){
 const m=await orgMembership(userId,orgId);
 if(!m||m.status!=="ACTIVE"||m.organization_status!=="ACTIVE")return {ok:false,reason:"ORG_ACCESS_DENIED"};
 if((ROLE_RANK[m.role]||0)<(ROLE_RANK[minRole]||0))return {ok:false,reason:"ORG_ROLE_REQUIRED",membership:m};
 return {ok:true,membership:m};
}
export async function requireOrgWrite(userId,orgId,minRole="MEMBER"){
 const gate=await requireOrgRole(userId,orgId,minRole);if(!gate.ok)return gate;
 const m=gate.membership;
 const trialValid=m.billing_status==="TRIAL"&&m.trial_ends_at&&new Date(m.trial_ends_at).getTime()>Date.now();
 if(m.billing_status!=="ACTIVE"&&!trialValid)return {ok:false,reason:"ORG_BILLING_REQUIRED",membership:m};
 return gate;
}
export async function activeSeatCount(orgId){
 return Number((await db.query("SELECT count(*)::int AS n FROM organization_memberships WHERE organization_id=$1 AND status='ACTIVE'",[orgId])).rows[0]?.n||0);
}
export async function writeOrgAudit({orgId,actor,action,targetType=null,targetId=null,metadata={}}){
 const safe=JSON.parse(JSON.stringify(metadata||{}));
 await db.query("INSERT INTO organization_audit_log(organization_id,actor_user_id,action,target_type,target_id,metadata) VALUES($1,$2,$3,$4,$5,$6::jsonb)",[orgId,actor,String(action).slice(0,100),targetType,targetId,JSON.stringify(safe)]);
}
export function orgError(res,gate){
 const status=gate.reason==="ORG_ROLE_REQUIRED"||gate.reason==="ORG_BILLING_REQUIRED"?403:404;
 return res.status(status).json({error:gate.reason,message:gate.reason==="ORG_ROLE_REQUIRED"?"Your organization role does not allow this action.":gate.reason==="ORG_BILLING_REQUIRED"?"This organization needs an active Business plan to make new workspace changes.":"Organization not found or unavailable."});
}