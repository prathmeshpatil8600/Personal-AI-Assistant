import { db } from "hatchable";
export const access = "member";
export const methods = ["PATCH"];
export default async function(req,res){
  const id=req.query?.id || req.params?.id;if(!id)return res.status(400).json({error:"Note id is required."});
  const b=req.body||{}, keys=["title","content","category","pinned","archived"],fields=[],values=[];
  for(const k of keys)if(b[k]!==undefined){fields.push(k+" = $"+(values.length+1));values.push(b[k])}
  if(!fields.length)return res.status(400).json({error:"No changes supplied."});
  fields.push("updated_at = now()");values.push(req.member.id,id);
  const {rows}=await db.query("UPDATE notes SET "+fields.join(", ")+" WHERE user_id = $"+(values.length-1)+" AND id = $"+values.length+" AND deleted_at IS NULL RETURNING id,title,content,category,pinned,archived,updated_at",values);
  if(!rows.length)return res.status(404).json({error:"Note not found."});res.json(rows[0]);
}