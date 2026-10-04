import { db } from "hatchable";
export const access="member";
export const methods=["GET","POST"];
export default async function(req,res){
 const userId=req.member.id;
 if(req.method==="GET"){
  const {rows}=await db.query("SELECT id,provider,server_name,server_url,auth_type,status,enabled,scopes,last_checked_at,last_success_at,last_error,created_at,updated_at FROM mcp_connections WHERE user_id=$1 ORDER BY provider,server_name",[userId]);
  return res.json(rows);
 }
 const b=req.body||{};
 const provider=String(b.provider||"").trim().toLowerCase();
 const serverName=String(b.server_name||"").trim();
 if(!provider||!serverName)return res.status(400).json({error:"provider and server_name are required."});
 const serverUrl=b.server_url?String(b.server_url).trim():null;
 if(serverUrl&&!/^https:\/\//i.test(serverUrl))return res.status(400).json({error:"server_url must use HTTPS."});
 const scopes=Array.isArray(b.scopes)?b.scopes.map(x=>String(x).slice(0,120)).slice(0,50):[];
 const {rows}=await db.query(`INSERT INTO mcp_connections(user_id,provider,server_name,server_url,auth_type,status,enabled,scopes,metadata)
 VALUES($1,$2,$3,$4,'OAUTH','DISCONNECTED',true,$5::jsonb,'{}'::jsonb)
 ON CONFLICT(user_id,provider,server_name) DO UPDATE SET server_url=EXCLUDED.server_url,scopes=EXCLUDED.scopes,updated_at=now()
 RETURNING id,provider,server_name,server_url,auth_type,status,enabled,scopes,created_at,updated_at`,[userId,provider,serverName,serverUrl,JSON.stringify(scopes)]);
 res.status(201).json(rows[0]);
}