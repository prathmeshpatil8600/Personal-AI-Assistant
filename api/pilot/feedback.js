import { db } from "hatchable";
export const access="user";
export const methods=["GET","POST"];
const CATS=new Set(["BUG","USABILITY","FEATURE","PERFORMANCE","OTHER"]);
const SEV=new Set(["LOW","MEDIUM","HIGH","CRITICAL"]);
export default async function(req,res){
 if(req.method==="GET"){
  const rows=(await db.query("SELECT id,category,severity,message,page,status,created_at,resolved_at FROM pilot_feedback WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",[req.user.id])).rows;
  return res.json(rows);
 }
 const category=String(req.body?.category||"OTHER").toUpperCase(),severity=String(req.body?.severity||"MEDIUM").toUpperCase(),message=String(req.body?.message||"").trim(),page=String(req.body?.page||"").slice(0,300)||null;
 if(!CATS.has(category)||!SEV.has(severity)||message.length<5||message.length>4000)return res.status(400).json({error:"Valid category, severity and message are required."});
 const row=(await db.query("INSERT INTO pilot_feedback(user_id,category,severity,message,page,metadata) VALUES($1,$2,$3,$4,$5,$6::jsonb) RETURNING id,category,severity,status,created_at",[req.user.id,category,severity,message,page,JSON.stringify({user_agent:String(req.headers?.["user-agent"]||"").slice(0,500)})])).rows[0];
 res.status(201).json(row);
}