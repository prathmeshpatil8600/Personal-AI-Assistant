import { db } from "hatchable";
export const access="member";
export const methods=["GET"];
export default async function(req,res){
 const limit=Math.max(1,Math.min(100,Number.parseInt(req.query?.limit,10)||50));
 const rows=(await db.query(`
  SELECT id,event_type,source,provider,model,purpose,input_tokens,output_tokens,
         bytes_processed,item_count,estimated_cost_microusd,priced,occurred_at
  FROM usage_events
  WHERE user_id=$1
  ORDER BY occurred_at DESC
  LIMIT $2
 `,[req.member.id,limit])).rows;
 res.json(rows);
}