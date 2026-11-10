import { runAiBenchmarkSuite } from "../../lib/ai-benchmark.js";
export const access="user";
export const methods=["POST"];
export default async function(req,res){
 if(req.headers?.["x-benchmark-smoke"]!=="secondbrain-l11")return res.status(404).json({error:"not_found"});
 res.json(await runAiBenchmarkSuite(req.user.id));
}