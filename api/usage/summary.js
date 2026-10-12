import { db } from "hatchable";
export const access="user";
export const methods=["GET"];
export default async function(req,res){
 const days=Math.max(1,Math.min(366,Number.parseInt(req.query?.days,10)||30));
 const uid=req.user.id;
 const totals=(await db.query(`
  SELECT count(*)::int events,
         COALESCE(sum(input_tokens),0)::bigint input_tokens,
         COALESCE(sum(output_tokens),0)::bigint output_tokens,
         COALESCE(sum(bytes_processed),0)::bigint bytes_processed,
         COALESCE(sum(item_count),0)::bigint items,
         COALESCE(sum(quota_units),0)::bigint quota_units,
         COALESCE(sum(estimated_cost_microusd) FILTER (WHERE priced),0)::bigint estimated_cost_microusd,
         count(*) FILTER (WHERE NOT priced)::int unpriced_events
  FROM usage_events
  WHERE user_id=$1 AND occurred_at >= now()-($2::int * interval '1 day')
 `,[uid,days])).rows[0];
 const byType=(await db.query(`
  SELECT event_type,provider,model,count(*)::int events,
         COALESCE(sum(input_tokens),0)::bigint input_tokens,
         COALESCE(sum(output_tokens),0)::bigint output_tokens,
         COALESCE(sum(bytes_processed),0)::bigint bytes_processed,
         COALESCE(sum(item_count),0)::bigint items,
         COALESCE(sum(quota_units),0)::bigint quota_units,
         COALESCE(sum(estimated_cost_microusd) FILTER (WHERE priced),0)::bigint estimated_cost_microusd,
         count(*) FILTER (WHERE NOT priced)::int unpriced_events
  FROM usage_events
  WHERE user_id=$1 AND occurred_at >= now()-($2::int * interval '1 day')
  GROUP BY event_type,provider,model
  ORDER BY events DESC,event_type,provider,model
 `,[uid,days])).rows;
 res.json({days,totals,by_type:byType,currency_basis:"USD micro-units",cost_is_estimate:true});
}