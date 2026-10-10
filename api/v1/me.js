import { authenticateApiKey } from "../../lib/developer-api.js";
import { getUsageState } from "../../lib/entitlements.js";
export const access="public";
export const methods=["GET"];
function bearer(req){const h=String(req.headers?.authorization||"");return h.startsWith("Bearer ")?h.slice(7).trim():""}
export default async function(req,res){
 const auth=await authenticateApiKey(bearer(req),"profile:read");
 if(!auth.ok)return res.status(auth.reason==="RATE_LIMIT"?429:401).json({error:auth.reason,limit:auth.limit||null});
 const s=await getUsageState(auth.key.user_id);
 res.json({object:"account",plan:s.plan.plan_code,plan_status:s.plan.status,usage_period:{start:s.plan.period_start,end:s.plan.period_end},api:{daily_limit:auth.daily_limit,request_count:auth.request_count}});
}