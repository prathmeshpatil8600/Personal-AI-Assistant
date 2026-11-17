import { db } from "hatchable";
import { requireAdminPortal } from "../../lib/admin-portal-auth.js";
import { computePilotDecision,savePilotDecision } from "../../lib/pilot-decision.js";
export const access="user";
export const methods=["GET","POST"];
export default async function(req,res){
 const admin=requireAdminPortal(req,res);if(!admin)return;
 if(req.method==="POST")return res.json(await savePilotDecision("PILOT_1"));
 const current=await computePilotDecision("PILOT_1");
 const history=(await db.query(`SELECT id,decision_date,cohort_decision,free_recommendation,plus_recommendation,pro_recommendation,confidence,reasons,created_at
  FROM pilot_pricing_decisions ORDER BY created_at DESC LIMIT 20`)).rows;
 res.json({current,history});
}