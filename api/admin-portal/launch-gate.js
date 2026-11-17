import { db } from "hatchable";
import { requireAdminPortal } from "../../lib/admin-portal-auth.js";
import { computeLaunchGate } from "../../lib/launch-gate.js";
export const access="user";
export const methods=["GET","POST"];

export default async function(req,res){
 const admin=requireAdminPortal(req,res);if(!admin)return;
 if(req.method==="GET")return res.json(await computeLaunchGate());

 const key=String(req.body?.check_key||"").trim();
 const confirmed=Boolean(req.body?.confirmed);
 const note=String(req.body?.note||"").trim().slice(0,1500);
 const allowed=["legal_identity","legal_review","refund_policy","tax_review","database_recovery","platform_identity_deletion","production_domain","browser_qa","multi_user_isolation"];
 if(!allowed.includes(key))return res.status(400).json({error:"invalid_manual_check"});

 const row=(await db.query(`UPDATE launch_manual_checks SET
  confirmed=$2,note=$3,confirmed_by=$4,
  confirmed_at=CASE WHEN $2 THEN now() ELSE NULL END,updated_at=now()
  WHERE check_key=$1
  RETURNING check_key,label,confirmed,note,confirmed_by,confirmed_at,updated_at`,
  [key,confirmed,note||null,admin.email||admin.id])).rows[0];
 if(!row)return res.status(404).json({error:"manual_check_not_found"});
 res.json({updated:row,gate:await computeLaunchGate()});
}