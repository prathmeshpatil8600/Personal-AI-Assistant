import { computeBusinessMetrics } from "../../lib/business-metrics.js";
export const access="admin";
export const methods=["GET"];
export default async function(req,res){
 const metrics=await computeBusinessMetrics();
 res.json(metrics);
}