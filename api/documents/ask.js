import { db } from "hatchable";
import { embedText } from "../../lib/openai-embed.js";
import { generateText } from "../../lib/ai-router.js";
export const access="member"; export const methods=["POST"];
function vec(v){return "["+v.join(",")+"]"}
export default async function(req,res){
 const q=typeof req.body?.query==="string"?req.body.query.trim():"";if(!q)return res.status(400).json({error:"query is required."});
 let vector;try{vector=await embedText(q,"RETRIEVAL_QUERY")}catch(e){return res.status(503).json({error:"Document Q&A is not configured yet.",detail:String(e.message||e).slice(0,300)})}
 const r=await db.query("SELECT dc.document_id,dc.chunk_index,dc.content,d.title,d.filename,1-(dv.embedding <=> $1::vector) AS similarity FROM document_vectors dv JOIN document_chunks dc ON dc.document_id=dv.document_id AND dc.chunk_index=dv.chunk_index JOIN documents d ON d.id=dv.document_id WHERE dv.user_id=$2 AND d.status='READY' ORDER BY dv.embedding <=> $1::vector LIMIT 8",[vec(vector),req.member.id]);
 const context=r.rows;
 const sourcePrompt=context.map((x,i)=>"[SOURCE "+(i+1)+"] "+x.title+" / "+x.filename+"\n"+x.content).join("\n\n");
 const answer=await generateText({model:"google.gemini",purpose:"document_qa",userId:req.member.id,system:"Answer using only the supplied document context. If the context does not contain the answer, say that the documents do not provide enough information. Cite sources inline as [Source N].",prompt:"Question: "+q+"\n\nDocument context:\n"+sourcePrompt});
 res.json({answer:answer.text,sources:context.map((x,i)=>({source:i+1,title:x.title,filename:x.filename,chunk_index:x.chunk_index,similarity:x.similarity})),provider:answer.provider,model:answer.model});
}