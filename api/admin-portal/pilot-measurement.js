import { db } from "hatchable";
import { requireAdminPortal } from "../../lib/admin-portal-auth.js";
import { computePilotMeasurement,savePilotMeasurement } from "../../lib/pilot-measurement.js";
export const access="user";
export const methods=["GET","POST"];
export default async function(req,res){
 const admin=requireAdminPortal(req,res);if(!admin)return;
 if(req.method==="POST")return res.json(await savePilotMeasurement("PILOT_1"));
 const current=await computePilotMeasurement("PILOT_1");
 const history=(await db.query(`SELECT snapshot_date,active_users,requests_7d,units_7d,
  ai_cost_microusd_7d,d1_percent,d3_percent,d7_percent,first_chat_percent,
  onboarding_percent,avg_requests_per_active_user,recommendation
  FROM pilot_measurement_daily ORDER BY snapshot_date DESC LIMIT 30`)).rows;
 res.json({current,history});
}