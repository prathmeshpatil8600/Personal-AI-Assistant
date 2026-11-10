import { requireAdminPortal } from "../../lib/admin-portal-auth.js";
import { runAiBenchmarkSuite,benchmarkHistory } from "../../lib/ai-benchmark.js";
export const access="user";
export const methods=["GET","POST"];
export default async function(req,res){
 const admin=requireAdminPortal(req,res);if(!admin)return;
 if(req.method==="POST"){
  const result=await runAiBenchmarkSuite(admin.id);
  return res.json(result);
 }
 res.json(await benchmarkHistory(10));
}