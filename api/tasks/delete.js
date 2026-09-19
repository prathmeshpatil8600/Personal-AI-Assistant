import { db } from "hatchable";
export const access = "member";
export const methods = ["DELETE"];
export default async function(req,res){
  const id=req.query?.id || req.params?.id;
  if(!id)return res.status(400).json({error:"Task id is required."});
  const {rowCount}=await db.query("UPDATE tasks SET status = 'CANCELLED', updated_at = now() WHERE user_id = $1 AND id = $2",[req.member.id,id]);
  if(!rowCount)return res.status(404).json({error:"Task not found."});
  res.json({success:true});
}