import { requireAdminPortal } from "../../lib/admin-portal-auth.js";
import { computeBusinessMetrics } from "../../lib/business-metrics.js";
export const access="user";
export const methods=["GET"];
export default async function(req,res){
 const admin=requireAdminPortal(req,res);if(!admin)return;
 const metrics=await computeBusinessMetrics();
 res.json(metrics);
}