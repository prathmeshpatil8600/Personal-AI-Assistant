import { ai, knowledge, db } from "hatchable";
export const access="member"; export const methods=["POST"];
export default async function(req,res){
 const q=typeof req.body?.query==="string"?req.body.query.trim():"";
 if(!q)return res.status(400).json({error:"query is required."});
 let emb;
 try{emb=await ai.embed(q)}catch(e){return res.status(503).json({error:"Document search is not configured yet.",detail:"An OpenAI API key is required for document embeddings."})}
 const base=knowledge.base("documents_"+req.member.id,{dimensions:1536});
 const hits=await base.searchByVector(emb.embedding,{limit:8,filter:{user_id:req.member.id}});
 const ids=(hits||[]).map(h=>h.id).filter(Boolean);let chunks=[];
 if(ids.length){const ph=ids.map((_,i)=>"$"+(i+1)).join(",");const r=await db.query("SELECT dc.document_id,dc.chunk_index,dc.content,d.title,d.filename FROM document_chunks dc JOIN documents d ON d.id=dc.document_id WHERE dc.user_id=$"+(ids.length+1)+" AND (d.id::text || ':' || dc.chunk_index) IN ("+ph+")",[...ids,req.member.id]);chunks=r.rows}
 res.json({query:q,results:chunks});
}