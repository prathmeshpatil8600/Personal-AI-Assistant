import { db } from "hatchable";
export const access="member";
export const methods=["POST","DELETE"];
export default async function(req,res){
 const id=String(req.body?.id||req.query?.id||"");
 if(!id)return res.status(400).json({error:"id is required"});
 const r=await db.query("DELETE FROM memories WHERE id=$1 AND user_id=$2 RETURNING id",[id,req.member.id]);
 if(!r.rows.length)return res.status(404).json({error:"Memory not found"});
 res.json({ok:true});
}