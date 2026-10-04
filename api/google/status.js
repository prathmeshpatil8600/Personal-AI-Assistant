import { db } from "hatchable";
export const access="member"; export const methods=["GET","DELETE"];
export default async function(req,res){
 if(req.method==="DELETE"){
  await db.query("DELETE FROM google_connections WHERE user_id=$1",[req.member.id]);
  await db.query("UPDATE mcp_connections SET status='DISCONNECTED',enabled=false,updated_at=now(),last_checked_at=now() WHERE user_id=$1 AND provider='google' AND server_name='google_workspace'",[req.member.id]);
  await db.query("UPDATE mcp_tool_registry SET enabled=false,updated_at=now() WHERE user_id=$1 AND provider='google'",[req.member.id]);
  return res.json({connected:false});
 }
 const c=(await db.query("SELECT account_email,scopes,status,connected_at,last_used_at,last_error FROM google_connections WHERE user_id=$1 LIMIT 1",[req.member.id])).rows[0];
 res.json(c?{connected:c.status==="CONNECTED",...c}:{connected:false});
}