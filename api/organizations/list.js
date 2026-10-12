import { db } from "hatchable";
export const access="user";
export const methods=["GET"];
export default async function(req,res){
 const rows=(await db.query(`
  SELECT o.id,o.name,o.slug,o.status,o.seat_limit,o.business_tier,o.entitlements,o.billing_status,o.trial_ends_at,
         m.role,m.status AS membership_status,
         (SELECT count(*)::int FROM organization_memberships x WHERE x.organization_id=o.id AND x.status='ACTIVE') AS active_seats
  FROM organization_memberships m
  JOIN organizations o ON o.id=m.organization_id
  WHERE m.user_id=$1 AND m.status='ACTIVE' AND o.status='ACTIVE'
  ORDER BY o.created_at ASC
 `,[req.user.id])).rows;
 res.json(rows);
}