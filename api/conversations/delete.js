import { db } from "hatchable";
export const access="user";
export const methods=["DELETE"];

export default async function(req,res){
 const id=String(req.query?.id||req.body?.id||"").trim();
 if(!id)return res.status(400).json({error:"Conversation id is required."});
 const row=(await db.query(
  "DELETE FROM conversations WHERE id=$1 AND user_id=$2 RETURNING id",
  [id,req.user.id]
 )).rows[0];
 if(!row)return res.status(404).json({error:"Conversation not found."});
 res.json({ok:true,id:row.id});
}