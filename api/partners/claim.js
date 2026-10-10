import { db } from "hatchable";
export const access="member";
export const methods=["POST"];
export default async function(req,res){
 const code=String(req.body?.code||"").trim().toUpperCase();
 if(!/^[A-Z0-9_-]{3,32}$/.test(code))return res.status(400).json({error:"invalid_partner_code"});
 const partner=(await db.query("SELECT code,partner_name,campaign FROM partner_codes WHERE code=$1 AND status='ACTIVE'",[code])).rows[0];
 if(!partner)return res.status(404).json({error:"partner_code_not_found"});
 const existing=(await db.query("SELECT partner_code,attributed_at FROM referral_attributions WHERE user_id=$1",[req.member.id])).rows[0];
 if(existing)return res.status(409).json({error:"attribution_already_set",attribution:existing});
 const row=(await db.query("INSERT INTO referral_attributions(user_id,partner_code,source,metadata) VALUES($1,$2,'user_claim','{}'::jsonb) ON CONFLICT(user_id) DO NOTHING RETURNING partner_code,attributed_at",[req.member.id,code])).rows[0];
 if(!row){const current=(await db.query("SELECT partner_code,attributed_at FROM referral_attributions WHERE user_id=$1",[req.member.id])).rows[0];return res.status(409).json({error:"attribution_already_set",attribution:current})}
 res.status(201).json({...row,partner_name:partner.partner_name,campaign:partner.campaign});
}