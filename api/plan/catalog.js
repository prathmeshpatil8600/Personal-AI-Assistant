import { db } from "hatchable";
export const access="user";
export const methods=["GET"];
export default async function(req,res){
 const rows=(await db.query("SELECT code,display_name,monthly_units,entitlements FROM plan_definitions WHERE active=true ORDER BY CASE code WHEN 'FREE' THEN 1 WHEN 'PLUS' THEN 2 ELSE 3 END")).rows;
 res.json(rows);
}