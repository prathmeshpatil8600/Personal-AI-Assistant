import { db } from "hatchable";
export const access="user";
export const methods=["POST"];
export default async function(req,res){
 const {id}=req.body||{}; if(!id)return res.status(400).json({error:"Goal id is required"});
 const {rowCount}=await db.query("UPDATE goals SET status='ARCHIVED',updated_at=now() WHERE id=$1 AND user_id=$2",[id,req.user.id]);
 if(!rowCount)return res.status(404).json({error:"Goal not found"});
 res.json({ok:true});
}