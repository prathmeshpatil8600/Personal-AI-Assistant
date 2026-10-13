import { db } from "hatchable";
export const access="user";
export const methods=["GET","POST"];
export default async function(req,res){
 if(req.method==="GET"){
  const rows=(await db.query("SELECT consent_key,policy_version,granted,source,created_at FROM privacy_consents WHERE user_id=$1 ORDER BY created_at DESC",[req.user.id])).rows;
  return res.json(rows);
 }
 const key=String(req.body?.consent_key||"").trim().slice(0,100),version=String(req.body?.policy_version||"").trim().slice(0,40),granted=req.body?.granted;
 if(!key||!version||typeof granted!=="boolean")return res.status(400).json({error:"consent_key, policy_version and boolean granted are required."});
 const row=(await db.query(`
  INSERT INTO privacy_consents(user_id,consent_key,policy_version,granted)
  VALUES($1,$2,$3,$4)
  ON CONFLICT(user_id,consent_key,policy_version) DO UPDATE SET granted=EXCLUDED.granted,created_at=now()
  RETURNING consent_key,policy_version,granted,created_at
 `,[req.user.id,key,version,granted])).rows[0];
 res.json(row);
}