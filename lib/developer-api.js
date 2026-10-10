import { db } from "hatchable";
import { getPlan } from "./entitlements.js";

function hex(bytes){return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("")}
export function generateApiKey(){
 const bytes=crypto.getRandomValues(new Uint8Array(32));
 const secret=hex(bytes);
 return {raw:"sb_live_"+secret,prefix:"sb_live_"+secret.slice(0,8)};
}
export async function hashApiKey(raw){
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(raw)));
 return hex(new Uint8Array(digest));
}
export async function canCreatePersonalApiKey(userId){
 const plan=await getPlan(userId);
 return {ok:plan.plan_code==="PRO"&&plan.status==="ACTIVE"&&plan.platform_entitlements?.api_access===true,plan};
}
export async function authenticateApiKey(raw,requiredScope="profile:read"){
 if(!raw||!String(raw).startsWith("sb_live_"))return {ok:false,reason:"INVALID_KEY"};
 const hash=await hashApiKey(raw);
 const key=(await db.query(`
  SELECT id,user_id,organization_id,scopes,status,expires_at
  FROM developer_api_keys
  WHERE key_hash=$1 LIMIT 1
 `,[hash])).rows[0];
 if(!key||key.status!=="ACTIVE")return {ok:false,reason:"INVALID_KEY"};
 const currentPlan=await getPlan(key.user_id);
 if(currentPlan.status!=="ACTIVE"||currentPlan.platform_entitlements?.api_access!==true)return {ok:false,reason:"API_ACCESS_INACTIVE"};
 if(key.expires_at&&new Date(key.expires_at).getTime()<=Date.now()){await db.query("UPDATE developer_api_keys SET status='EXPIRED' WHERE id=$1",[key.id]);return {ok:false,reason:"EXPIRED_KEY"}}
 const scopes=Array.isArray(key.scopes)?key.scopes:[];
 if(requiredScope&&!scopes.includes(requiredScope))return {ok:false,reason:"SCOPE_REQUIRED"};
 const dailyLimit=Math.max(1,Math.min(100000,Number(currentPlan.platform_entitlements?.api_daily_requests)||100));
 const usage=(await db.query(`
  INSERT INTO developer_api_usage_daily(api_key_id,usage_date,request_count)
  VALUES($1,CURRENT_DATE,1)
  ON CONFLICT(api_key_id,usage_date) DO UPDATE SET request_count=developer_api_usage_daily.request_count+1
  RETURNING request_count
 `,[key.id])).rows[0];
 if(Number(usage.request_count)>dailyLimit)return {ok:false,reason:"RATE_LIMIT",limit:dailyLimit};
 await db.query("UPDATE developer_api_keys SET last_used_at=now() WHERE id=$1",[key.id]);
 return {ok:true,key,daily_limit:dailyLimit,request_count:Number(usage.request_count)};
}