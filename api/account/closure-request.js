import { db } from "hatchable";
export const access="user";
export const methods=["GET","POST","DELETE"];

async function keyFor(userId){
 const raw=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(userId)));
 const hex=Array.from(new Uint8Array(raw),b=>b.toString(16).padStart(2,"0")).join("");
 return "account-closure:"+hex.slice(0,32);
}

export default async function(req,res){
 const key=await keyFor(req.user.id);
 if(req.method==="GET"){
  const row=(await db.query("SELECT id,severity,message,metadata,created_at,resolved_at FROM operational_incidents WHERE incident_key=$1 ORDER BY created_at DESC LIMIT 1",[key])).rows[0]||null;
  return res.json({request:row});
 }
 if(req.method==="DELETE"){
  const row=(await db.query("UPDATE operational_incidents SET resolved_at=now() WHERE incident_key=$1 AND resolved_at IS NULL RETURNING id,resolved_at",[key])).rows[0]||null;
  return res.json({cancelled:Boolean(row),request:row});
 }
 const existing=(await db.query("SELECT id,created_at FROM operational_incidents WHERE incident_key=$1 AND resolved_at IS NULL LIMIT 1",[key])).rows[0];
 if(existing)return res.status(409).json({error:"closure_request_exists",request:existing});
 const row=(await db.query(
  "INSERT INTO operational_incidents(source,severity,incident_key,message,metadata) VALUES('privacy','INFO',$1,$2,$3::jsonb) RETURNING id,created_at",
  [key,"Authenticated user requested account closure and application-data erasure review.",JSON.stringify({user_id:req.user.id,email:req.user.email||null})]
 )).rows[0];
 res.status(201).json({ok:true,request:row,next_step:"Admin review is required before irreversible erasure."});
}