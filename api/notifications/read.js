import { db } from "hatchable";
export const access="user";
export const methods=["POST"];
export default async function(req,res){
 const id=String(req.body?.id||""); if(!id)return res.status(400).json({error:"id is required"});
 await db.query("UPDATE assistant_notifications SET read_at=now() WHERE id=$1 AND user_id=$2",[id,req.user.id]);
 res.json({ok:true});
}