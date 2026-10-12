import { db } from "hatchable";
export const access="user";
export const methods = ["PATCH"];
export default async function(req,res){
  const id=req.query?.id || req.params?.id;
  if(!id) return res.status(400).json({error:"Task id is required."});
  const b=req.body||{}, fields=[], values=[], allowed={title:"title",description:"description",priority:"priority",status:"status",due_at:"due_at",tags:"tags"};
  for(const k of Object.keys(allowed)){ if(b[k]!==undefined){ fields.push(k+" = $"+(values.length+1)); values.push(b[k]); } }
  if(!fields.length) return res.status(400).json({error:"No changes supplied."});
  fields.push("updated_at = now()");
  values.push(req.user.id,id);
  const {rows}=await db.query("UPDATE tasks SET "+fields.join(", ")+" WHERE user_id = $"+(values.length-1)+" AND id = $"+values.length+" RETURNING id,title,description,priority,status,due_at,tags,updated_at",values);
  if(!rows.length)return res.status(404).json({error:"Task not found."});
  res.json(rows[0]);
}