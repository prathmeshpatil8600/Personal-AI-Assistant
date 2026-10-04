import { db } from "hatchable";
import { exchangeCode, encryptSecret, googleFetch } from "../../lib/google-oauth.js";
export const access="member"; export const methods=["GET"];
export default async function(req,res){
 const code=String(req.query?.code||""),state=String(req.query?.state||"");
 if(!code||!state)return res.status(400).send("Missing Google OAuth code or state.");
 const s=(await db.query("DELETE FROM google_oauth_states WHERE state=$1 AND user_id=$2 AND expires_at>now() RETURNING redirect_uri",[state,req.member.id])).rows[0];
 if(!s)return res.status(400).send("OAuth state is invalid or expired.");
 try{
  const tokens=await exchangeCode({code,redirectUri:s.redirect_uri});
  if(!tokens.refresh_token)return res.status(400).send("Google did not return a refresh token. Revoke prior consent and reconnect.");
  const enc=await encryptSecret(tokens.refresh_token);
  const granted=String(tokens.scope||"").split(/\s+/).filter(Boolean);
  await db.query(`INSERT INTO google_connections(user_id,encrypted_refresh_token,token_iv,scopes,status) VALUES($1,$2,$3,$4,'CONNECTED') ON CONFLICT(user_id) DO UPDATE SET encrypted_refresh_token=EXCLUDED.encrypted_refresh_token,token_iv=EXCLUDED.token_iv,scopes=EXCLUDED.scopes,status='CONNECTED',updated_at=now(),connected_at=now(),last_error=NULL`,[req.member.id,enc.ciphertext,enc.iv,granted]);
  const profile=await googleFetch(req.member.id,"https://openidconnect.googleapis.com/v1/userinfo");
  await db.query("UPDATE google_connections SET account_email=$1 WHERE user_id=$2",[profile.email||null,req.member.id]);
  const conn=await db.query(`INSERT INTO mcp_connections(user_id,provider,server_name,server_url,auth_type,status,enabled,scopes,metadata,last_checked_at,last_success_at) VALUES($1,'google','google_workspace',NULL,'OAUTH','CONNECTED',true,$2::jsonb,$3::jsonb,now(),now()) ON CONFLICT(user_id,provider,server_name) DO UPDATE SET status='CONNECTED',enabled=true,scopes=EXCLUDED.scopes,metadata=EXCLUDED.metadata,last_checked_at=now(),last_success_at=now(),last_error=NULL,updated_at=now() RETURNING id`,[req.member.id,JSON.stringify(granted),JSON.stringify({account_email:profile.email||null})]);
  const connectionId=conn.rows[0].id;
  const toolRows=[
   ['google_search_gmail','Search connected Gmail read-only.','READ'],
   ['google_list_calendar','List connected Google Calendar events read-only.','READ'],
   ['google_search_drive','Search connected Google Drive file metadata read-only.','READ']
  ];
  for(const [name,description,risk] of toolRows){await db.query(`INSERT INTO mcp_tool_registry(user_id,connection_id,tool_name,provider,description,risk_level,enabled,last_seen_at) VALUES($1,$2,$3,'google',$4,$5,true,now()) ON CONFLICT(user_id,provider,tool_name) DO UPDATE SET connection_id=EXCLUDED.connection_id,description=EXCLUDED.description,risk_level=EXCLUDED.risk_level,enabled=true,last_seen_at=now(),updated_at=now()`,[req.member.id,connectionId,name,description,risk]);}
  res.send("Google account connected successfully. You can close this window and return to SecondBrain.");
 }catch(e){res.status(500).send("Google connection failed: "+String(e?.message||e).slice(0,500))}
}