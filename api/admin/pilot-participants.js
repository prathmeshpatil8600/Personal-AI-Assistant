import { db } from "hatchable";
export const access="admin";
export const methods=["GET","POST","DELETE"];
export default async function(req,res){
 if(req.method==="GET"){
  const rows=(await db.query(`SELECT p.user_id,u.email,u.name,p.cohort,p.status,p.activated_at,p.last_seen_at,p.created_at,p.updated_at
   FROM pilot_participants p LEFT JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC LIMIT 500`)).rows;
  return res.json(rows);
 }
 const rawUserId=String(req.body?.user_id||"").trim(),email=String(req.body?.email||"").trim().toLowerCase();
 let uid=rawUserId;
 if(!uid&&email){
  const u=(await db.query("SELECT id,email,name FROM users WHERE lower(email)=lower($1) LIMIT 1",[email])).rows[0];
  if(!u)return res.status(404).json({error:"user_not_found",message:"The user must sign in once before being managed in the pilot."});
  uid=u.id;
 }
 if(!uid)return res.status(400).json({error:"user_id or email is required"});
 if(req.method!=="DELETE"){
  const existing=await db.query("SELECT cohort,status FROM pilot_participants WHERE user_id=$1",[uid]);
  const isExisting=existing.rows.length>0&&existing.rows[0].cohort==="PILOT_1"&&["INVITED","ACTIVE"].includes(existing.rows[0].status);
  if(!isExisting){
   const count=Number((await db.query("SELECT count(*)::int n FROM pilot_participants WHERE cohort='PILOT_1' AND status IN ('INVITED','ACTIVE')")).rows[0]?.n||0);
   if(count>=5)return res.status(409).json({error:"pilot_wave_full",message:"Wave 1 is capped at five invited/active users until the Day-7 review."});
  }
 }
 if(req.method==="DELETE"){
  await db.query("DELETE FROM user_onboarding WHERE user_id=$1",[uid]).catch(()=>{});
  const removed=(await db.query("DELETE FROM pilot_participants WHERE user_id=$1 RETURNING user_id",[uid])).rows[0];
  if(!removed)return res.status(404).json({error:"participant_not_found"});
  return res.json({ok:true,user_id:uid});
 }
 const status=String(req.body?.status||"INVITED").toUpperCase(),cohort=String(req.body?.cohort||"PILOT_1").trim().slice(0,40);
 if(!["INVITED","ACTIVE","PAUSED","REMOVED"].includes(status))return res.status(400).json({error:"valid status is required"});
 const row=(await db.query(`INSERT INTO pilot_participants(user_id,cohort,status,invited_by)
 VALUES($1,$2,$3,'admin')
 ON CONFLICT(user_id) DO UPDATE SET cohort=EXCLUDED.cohort,status=EXCLUDED.status,updated_at=now()
 RETURNING user_id,cohort,status,activated_at,last_seen_at,created_at,updated_at`,[uid,cohort,status])).rows[0];
 const u=(await db.query("SELECT email,name FROM users WHERE id=$1",[uid])).rows[0]||{};
 res.json({...row,email:u.email||null,name:u.name||null});
}