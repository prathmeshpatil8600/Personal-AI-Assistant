import { db } from "hatchable";

export async function activeAddonEffects(userId){
 const rows=(await db.query(`
  SELECT effects FROM addon_grants
  WHERE user_id=$1 AND revoked_at IS NULL
    AND starts_at<=now() AND (expires_at IS NULL OR expires_at>now())
 `,[userId])).rows;
 const out={quota_units:0,max_documents:0,max_memory_items:0,feature_flags:new Set()};
 for(const r of rows){
  const e=r.effects||{};
  out.quota_units+=Math.max(0,Number(e.quota_units)||0);
  out.max_documents+=Math.max(0,Number(e.max_documents)||0);
  out.max_memory_items+=Math.max(0,Number(e.max_memory_items)||0);
  for(const f of Array.isArray(e.feature_flags)?e.feature_flags:[])out.feature_flags.add(String(f));
 }
 return {...out,feature_flags:[...out.feature_flags]};
}

export async function grantAddon({userId,addonCode,orderId=null,source="PURCHASE"}){
 const addon=(await db.query("SELECT code,effects,validity_days FROM addon_catalog WHERE code=$1 AND active=true",[addonCode])).rows[0];
 if(!addon)throw new Error("Unknown or inactive add-on.");
 let expiresAt=null;
 if(addon.validity_days)expiresAt=new Date(Date.now()+Number(addon.validity_days)*86400000);
 try{
  const row=(await db.query(`
   INSERT INTO addon_grants(user_id,addon_code,addon_order_id,source,effects,expires_at)
   VALUES($1,$2,$3,$4,$5::jsonb,$6)
   RETURNING id,user_id,addon_code,source,effects,starts_at,expires_at
  `,[userId,addonCode,orderId,source,JSON.stringify(addon.effects||{}),expiresAt])).rows[0];
  return row;
 }catch(e){
  if(orderId){
   const existing=(await db.query("SELECT id,user_id,addon_code,source,effects,starts_at,expires_at FROM addon_grants WHERE addon_order_id=$1",[orderId])).rows[0];
   if(existing)return existing;
  }
  throw e;
 }
}

export async function addonCatalogForPlan(planCode){
 const rows=(await db.query("SELECT code,display_name,description,price_inr,effects,eligible_plans,validity_days FROM addon_catalog WHERE active=true ORDER BY sort_order,code")).rows;
 return rows.map(x=>({...x,eligible:Array.isArray(x.eligible_plans)&&x.eligible_plans.includes(planCode)}));
}