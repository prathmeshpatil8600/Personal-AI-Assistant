import { db, ai, knowledge } from "hatchable";
import { generateText } from "../../lib/ai-router.js";
export const access="member";
export const methods=["POST"];
export default async function(req,res){
 const q=typeof req.body?.query==="string"?req.body.query.trim():"";
 if(!q)return res.status(400).json({error:"query is required."});
 const emb=await ai.embed(q);
 const base=knowledge.base("documents_"+req.member.id,{dimensions:1536});
 const hits=await base.searchByVector(emb.embedding,{limit:8,filter:{user_id:req.member.id}});
 const ids=(hits||[]).map(h=>h.id).filter(Boolean);
 let context=[];
 if(ids.length){
  const ph=ids.map((_,i)=>"$"+(i+1)).join(",");
  const r=await db.query("SELECT dc.document_id,dc.chunk_index,dc.content,d.title,d.filename FROM document_chunks dc JOIN documents d ON d.id=dc.document_id WHERE dc.user_id=$"+(ids.length+1)+" AND (d.id::text || ':' || dc.chunk_index) IN ("+ph+")",[...ids,req.member.id]);
  context=r.rows;
 }
 const sourcePrompt=context.map((x,i)=>"[SOURCE "+(i+1)+"] "+x.title+" / "+x.filename+"\n"+x.content).join("\n\n");
 const answer=await generateText({
  model:"google.gemini",
  purpose:"document_qa",
  userId:req.member.id,
  system:"Answer using only the supplied document context. If the context does not contain the answer, say that the documents do not provide enough information. Cite sources inline as [Source N].",
  prompt:"Question: "+q+"\n\nDocument context:\n"+sourcePrompt
 });
 res.json({answer:answer.text,sources:context.map((x,i)=>({source:i+1,title:x.title,filename:x.filename,chunk_index:x.chunk_index})),provider:answer.provider,model:answer.model});
}