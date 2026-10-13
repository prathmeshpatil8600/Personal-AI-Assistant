import { db } from "hatchable";
export const access="user";
export const methods=["GET","POST"];
const CATEGORIES=new Set(["ACCESS","CORRECTION","ERASURE","CONSENT","PRIVACY","OTHER"]);
export default async function(req,res){
 if(req.method==="GET"){
  const rows=(await db.query("SELECT id,category,message,status,resolution,created_at,updated_at,resolved_at FROM privacy_grievances WHERE user_id=$1 ORDER BY created_at DESC",[req.user.id])).rows;
  return res.json(rows);
 }
 const category=String(req.body?.category||"OTHER").toUpperCase(),message=String(req.body?.message||"").trim();
 if(!CATEGORIES.has(category)||message.length<10||message.length>4000)return res.status(400).json({error:"Valid category and message (10–4000 characters) are required."});
 const row=(await db.query("INSERT INTO privacy_grievances(user_id,category,message) VALUES($1,$2,$3) RETURNING id,category,status,created_at",[req.user.id,category,message])).rows[0];
 res.status(201).json(row);
}