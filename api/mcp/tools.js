import { db } from "hatchable";
export const access="member";
export const methods=["GET"];
export default async function(req,res){
 const {rows}=await db.query("SELECT id,connection_id,tool_name,provider,description,risk_level,enabled,last_seen_at,created_at,updated_at FROM mcp_tool_registry WHERE user_id=$1 ORDER BY provider,tool_name",[req.member.id]);
 res.json(rows);
}