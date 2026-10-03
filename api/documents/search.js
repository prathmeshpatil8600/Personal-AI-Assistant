import { db } from "hatchable";
import { embedText } from "../../lib/openai-embed.js";
export const access="member"; export const methods=["POST"];
function vec(v){return "["+v.join(",")+"]"}
export default async function(req,res){
 const q=typeof req.body?.query==="string"?req.body.query.trim():"";if(!q)return res.status(400).json({error:"query is required."});
 let vector;try{vector=await embedText(q,"RETRIEVAL_QUERY")}catch(e){return res.status(503).json({error:"Document search is not configured yet.",detail:String(e.message||e).slice(0,300)})}
 const r=await db.query("SELECT dc.document_id,dc.chunk_index,dc.content,d.title,d.filename,1-(dv.embedding <=> $1::vector) AS similarity FROM document_vectors dv JOIN document_chunks dc ON dc.document_id=dv.document_id AND dc.chunk_index=dv.chunk_index JOIN documents d ON d.id=dv.document_id WHERE dv.user_id=$2 AND d.status='READY' ORDER BY dv.embedding <=> $1::vector LIMIT 12",[vec(vector),req.member.id]);
 const results=r.rows.filter(x=>Number(x.similarity)>=0.52).slice(0,8);
 res.json({query:q,results,threshold:0.52});
}