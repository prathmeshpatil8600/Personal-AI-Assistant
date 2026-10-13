import { db } from "hatchable";
import { revokeGoogleAuthorization } from "../../lib/google-oauth.js";
export const access="user"; export const methods=["GET","DELETE"];
export default async function(req,res){
 if(req.method==="DELETE"){
  let provider_revoked=false;
  try{provider_revoked=(await revokeGoogleAuthorization(req.user.id)).revoked===true}catch{}
  await db.query("DELETE FROM google_connections WHERE user_id=$1",[req.user.id]);
  await db.query("UPDATE mcp_connections SET status='DISCONNECTED',enabled=false,updated_at=now(),last_checked_at=now() WHERE user_id=$1 AND provider='google' AND server_name='google_workspace'",[req.user.id]);
  await db.query("UPDATE mcp_tool_registry SET enabled=false,updated_at=now() WHERE user_id=$1 AND provider='google'",[req.user.id]);
  return res.json({connected:false,provider_revoked});
 }
 const c=(await db.query("SELECT account_email,scopes,status,connected_at,last_used_at,last_error FROM google_connections WHERE user_id=$1 LIMIT 1",[req.user.id])).rows[0];
 if(!c)return res.json({connected:false});
 const required=["https://www.googleapis.com/auth/gmail.send","https://www.googleapis.com/auth/calendar.events"];
 const granted=Array.isArray(c.scopes)?c.scopes:[];const missing_write_scopes=required.filter(s=>!granted.includes(s));
 res.json({connected:c.status==="CONNECTED",...c,reconnect_required:missing_write_scopes.length>0,missing_write_scopes});
}