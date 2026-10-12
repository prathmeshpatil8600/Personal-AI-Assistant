import { db } from "hatchable";
export const access="user";
export const methods=["GET"];
export default async function(req,res){
 const userId=req.user.id;
 const c=await db.query("SELECT status,count(*)::int AS count FROM mcp_connections WHERE user_id=$1 GROUP BY status ORDER BY status",[userId]);
 const t=await db.query("SELECT risk_level,count(*)::int AS count FROM mcp_tool_registry WHERE user_id=$1 AND enabled=true GROUP BY risk_level ORDER BY risk_level",[userId]);
 res.json({enabled:true,endpoint:"/mcp",connections:c.rows,registered_tools:t.rows,foundation:{oauth:true,governance:true,audit:true,approval_gate:true}});
}