import { db } from "hatchable";
export const access="user"; export const methods=["DELETE"];
export default async function(req,res){
 const id=req.query?.id||req.params?.id;if(!id)return res.status(400).json({error:"Event id is required."});
 const r=await db.query("UPDATE calendar_events SET status='CANCELLED',updated_at=now() WHERE user_id=$1 AND id=$2",[req.user.id,id]);
 if(!r.rowCount)return res.status(404).json({error:"Event not found."});res.json({success:true});
}