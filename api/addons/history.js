import { db } from "hatchable";
export const access="user";
export const methods=["GET"];
export default async function(req,res){
 const rows=(await db.query(`
  SELECT o.id,o.addon_code,c.display_name,o.amount_inr,o.currency,o.status,o.paid_at,o.created_at,
         g.effects,g.starts_at,g.expires_at,g.revoked_at
  FROM addon_orders o
  JOIN addon_catalog c ON c.code=o.addon_code
  LEFT JOIN addon_grants g ON g.addon_order_id=o.id
  WHERE o.user_id=$1
  ORDER BY o.created_at DESC LIMIT 50
 `,[req.user.id])).rows;
 res.json(rows);
}