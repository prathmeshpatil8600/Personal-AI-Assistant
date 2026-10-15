import { computePilotReview,savePilotReview } from "../../lib/pilot-review.js";
import { db } from "hatchable";
export const access="admin";
export const methods=["GET","POST"];
export default async function(req,res){
 const cohort=String(req.query?.cohort||req.body?.cohort||"PILOT_1").slice(0,40);
 if(req.method==="POST"){
  const checkpoint=String(req.body?.checkpoint||"MANUAL").toUpperCase().slice(0,20);
  return res.json(await savePilotReview({cohort,checkpoint}));
 }
 const current=await computePilotReview(cohort);
 const history=(await db.query("SELECT review_date,checkpoint,recommendation,metrics,reasons,created_at FROM pilot_review_snapshots WHERE cohort=$1 ORDER BY review_date DESC,created_at DESC LIMIT 30",[cohort])).rows;
 res.json({current,history});
}