import { db } from "hatchable";
export const access="member";
export const methods=["GET"];
export default async function(req,res){
 const row=(await db.query(`
  SELECT r.partner_code,p.partner_name,p.campaign,r.attributed_at
  FROM referral_attributions r JOIN partner_codes p ON p.code=r.partner_code
  WHERE r.user_id=$1
 `,[req.member.id])).rows[0]||null;
 res.json({attribution:row});
}