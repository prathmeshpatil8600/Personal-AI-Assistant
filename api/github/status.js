import { db } from "hatchable";
export const access="member"; export const methods=["GET","DELETE"];
export default async function(req,res){
 const userId=req.member.id;
 if(req.method==="DELETE"){
  await db.query("DELETE FROM github_connections WHERE user_id=$1",[userId]);
  await db.query("UPDATE mcp_connections SET status='DISCONNECTED',enabled=false,updated_at=now() WHERE user_id=$1 AND provider='github'",[userId]);
  await db.query("UPDATE mcp_tool_registry SET enabled=false,updated_at=now() WHERE user_id=$1 AND provider='github'",[userId]);
  return res.json({connected:false});
 }
 const row=(await db.query("SELECT login,status,connected_at,updated_at,last_used_at,last_error,access_token_expires_at,refresh_token_expires_at FROM github_connections WHERE user_id=$1 LIMIT 1",[userId])).rows[0];
 if(!row)return res.json({connected:false});
 res.json({connected:row.status==='CONNECTED',...row,required_app_permissions:{metadata:'read',contents:'read',issues:'write',pull_requests:'read'},write_actions_require_approval:true});
}