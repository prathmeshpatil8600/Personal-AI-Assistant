import { db } from "hatchable";
export const access="admin";
export const methods=["POST"];
export default async function(req,res){
 const code=String(req.body?.code||"").trim().toUpperCase(),name=String(req.body?.partner_name||"").trim(),campaign=String(req.body?.campaign||"").trim().slice(0,120)||null;
 if(!/^[A-Z0-9_-]{3,32}$/.test(code)||name.length<2||name.length>120)return res.status(400).json({error:"Valid code and partner_name are required."});
 const row=(await db.query("INSERT INTO partner_codes(code,partner_name,campaign) VALUES($1,$2,$3) ON CONFLICT(code) DO UPDATE SET partner_name=EXCLUDED.partner_name,campaign=EXCLUDED.campaign,updated_at=now() RETURNING code,partner_name,status,campaign,created_at,updated_at",[code,name,campaign])).rows[0];
 res.json(row);
}