import { db } from "hatchable";
import { canCreatePersonalApiKey,generateApiKey,hashApiKey } from "../../lib/developer-api.js";
export const access="member";
export const methods=["POST"];
const allowed=new Set(["profile:read","usage:read"]);
export default async function(req,res){
 const name=String(req.body?.name||"").trim();
 const scopes=Array.isArray(req.body?.scopes)?[...new Set(req.body.scopes.map(String))]:["profile:read"];
 if(name.length<2||name.length>80||!scopes.length||scopes.some(s=>!allowed.has(s)))return res.status(400).json({error:"Valid key name and supported scopes are required."});
 const gate=await canCreatePersonalApiKey(req.member.id);
 if(!gate.ok)return res.status(403).json({error:"api_access_not_included",message:"Developer API access requires an active Pro plan."});
 const active=Number((await db.query("SELECT count(*)::int AS n FROM developer_api_keys WHERE user_id=$1 AND organization_id IS NULL AND status='ACTIVE'",[req.member.id])).rows[0]?.n||0);
 if(active>=5)return res.status(429).json({error:"api_key_limit",message:"Maximum 5 active API keys."});
 const {raw,prefix}=generateApiKey(),hash=await hashApiKey(raw);
 const row=(await db.query(`
  INSERT INTO developer_api_keys(user_id,name,key_prefix,key_hash,scopes)
  VALUES($1,$2,$3,$4,$5::jsonb)
  RETURNING id,name,key_prefix,scopes,status,created_at
 `,[req.member.id,name,prefix,hash,JSON.stringify(scopes)])).rows[0];
 res.status(201).json({...row,api_key:raw,warning:"Store this key now. It will not be shown again."});
}