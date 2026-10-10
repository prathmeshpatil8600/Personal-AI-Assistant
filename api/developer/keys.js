import { db } from "hatchable";
export const access="member";
export const methods=["GET"];
export default async function(req,res){
 const rows=(await db.query(`
  SELECT id,name,key_prefix,scopes,status,expires_at,last_used_at,created_at,revoked_at
  FROM developer_api_keys
  WHERE user_id=$1 AND organization_id IS NULL
  ORDER BY created_at DESC
 `,[req.member.id])).rows;
 res.json(rows);
}