import { db } from "hatchable";
export const access="user";
export const methods = ["POST"];
export default async function(req,res){
 const id=req.query?.id||req.params?.id;if(!id)return res.status(400).json({error:"Reminder id is required."});
 const {rowCount}=await db.query("UPDATE reminders SET status='CANCELLED',updated_at=now() WHERE user_id=$1 AND id=$2",[req.user.id,id]);
 if(!rowCount)return res.status(404).json({error:"Reminder not found."});res.json({success:true});
}