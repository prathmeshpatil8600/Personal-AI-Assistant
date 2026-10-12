import { db } from "hatchable";
export const access="user";
export const methods=["POST"];
export default async function(req,res){
 const b=req.body||{}; const id=b.id;
 if(!id) return res.status(400).json({error:"Goal id is required"});
 const progress=Math.max(0,Math.min(100,Number(b.progress_percent??0)));
 const status=b.status||"ACTIVE";
 const {rows}=await db.query("UPDATE goals SET title=COALESCE($3,title),description=COALESCE($4,description),category=COALESCE($5,category),target_date=COALESCE($6,target_date),progress_percent=$7,status=$8,updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING *",[id,req.user.id,b.title??null,b.description??null,b.category??null,b.target_date??null,progress,status]);
 if(!rows[0]) return res.status(404).json({error:"Goal not found"});
 res.json(rows[0]);
}