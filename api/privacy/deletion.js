import { db } from "hatchable";
export const access="user";
export const methods=["GET","POST","DELETE"];

async function blockers(uid){
 const out=[];
 const owned=(await db.query("SELECT id,name FROM organizations WHERE owner_user_id=$1 AND status='ACTIVE' LIMIT 20",[uid])).rows;
 if(owned.length)out.push({code:"OWNS_ORGANIZATION",message:"Transfer or close owned organizations before deleting your account.",items:owned});
 const sub=(await db.query("SELECT status,plan_code,billing_cycle,current_period_end FROM billing_subscriptions WHERE user_id=$1 LIMIT 1",[uid])).rows[0];
 if(sub&&!["CANCELLED","COMPLETED","EXPIRED"].includes(sub.status))out.push({code:"ACTIVE_SUBSCRIPTION",message:"Cancel the paid subscription and wait until it becomes inactive before deletion.",subscription:sub});
 return out;
}

export default async function(req,res){
 const uid=req.user.id;
 if(req.method==="GET"){
  const row=(await db.query("SELECT status,requested_at,execute_after,cancelled_at,completed_at,blockers,updated_at FROM account_deletion_requests WHERE user_id=$1",[uid])).rows[0]||null;
  return res.json({request:row});
 }
 if(req.method==="DELETE"){
  const row=(await db.query("UPDATE account_deletion_requests SET status='CANCELLED',cancelled_at=now(),updated_at=now() WHERE user_id=$1 AND status IN ('REQUESTED','BLOCKED') RETURNING status,cancelled_at",[uid])).rows[0];
  if(!row)return res.status(404).json({error:"No cancellable deletion request found."});
  return res.json({ok:true,request:row});
 }
 const found=await blockers(uid);
 const status=found.length?"BLOCKED":"REQUESTED";
 const row=(await db.query(`
  INSERT INTO account_deletion_requests(user_id,status,execute_after,blockers,metadata)
  VALUES($1,$2,now()+interval '7 days',$3::jsonb,'{"grace_days":7}'::jsonb)
  ON CONFLICT(user_id) DO UPDATE SET status=EXCLUDED.status,requested_at=now(),execute_after=EXCLUDED.execute_after,
    cancelled_at=NULL,completed_at=NULL,blockers=EXCLUDED.blockers,updated_at=now()
  RETURNING status,requested_at,execute_after,blockers
 `,[uid,status,JSON.stringify(found)])).rows[0];
 res.status(201).json({request:row,message:found.length?"Resolve the listed blockers, then request deletion again.":"Deletion requested. You can cancel during the 7-day grace period."});
}