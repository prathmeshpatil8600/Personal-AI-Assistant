import { db } from "hatchable";
import { requireAdminPortal } from "../../lib/admin-portal-auth.js";
export const access="user";
export const methods=["GET"];
export default async function(req,res){
 const admin=requireAdminPortal(req,res);if(!admin)return;
 const rows=(await db.query(`SELECT snapshot_date,status,active_pilot_users,
  projected_monthly_ai_cost_usd_per_active_user,
  plus_break_even_conversion_percent,blended_break_even_conversion_percent
  FROM unit_economics_daily_snapshots ORDER BY snapshot_date DESC LIMIT 30`)).rows;
 res.json(rows);
}