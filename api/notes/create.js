import { db } from "hatchable";
export const access="user";
export const methods = ["POST"];
export default async function(req,res){
  const b=req.body||{}, title=typeof b.title==="string"?b.title.trim():"";
  if(!title)return res.status(400).json({error:"Title is required."});
  const {rows}=await db.query("INSERT INTO notes (user_id,title,content,category,pinned,archived) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,title,content,category,pinned,archived,created_at,updated_at",[req.user.id,title,typeof b.content==="string"?b.content:"",typeof b.category==="string"&&b.category?b.category:"General",Boolean(b.pinned),Boolean(b.archived)]);
  res.status(201).json(rows[0]);
}