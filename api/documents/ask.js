import { db } from "hatchable";
import { embedText } from "../../lib/gemini-embed.js";
import { generateText } from "../../lib/ai-router.js";
import { recordUsageEvent } from "../../lib/usage-meter.js";
import { requireFeature,requireUnits,entitlementError } from "../../lib/entitlements.js";
import { enforceUserRateLimit,rateLimitError } from "../../lib/rate-limit.js";
export const access="user"; export const methods=["POST"];
function vec(v){return "["+v.join(",")+"]"}
export default async function(req,res){
 const rate=await enforceUserRateLimit(req.user.id,"document_qa",{limit:20,windowSeconds:60});if(!rate.ok)return rateLimitError(res,rate);
 const q=typeof req.body?.query==="string"?req.body.query.trim():"";if(!q)return res.status(400).json({error:"query is required."});const featureGate=await requireFeature(req.user.id,"documents");if(!featureGate.ok)return entitlementError(res,featureGate);const unitGate=await requireUnits(req.user.id,2);if(!unitGate.ok)return entitlementError(res,unitGate);
 let vector;try{vector=await embedText(q,"RETRIEVAL_QUERY");await recordUsageEvent({userId:req.user.id,eventKey:"embedding-query:"+crypto.randomUUID(),eventType:"embedding_query",source:"document",provider:"google",model:"gemini-embedding-001",bytesProcessed:new TextEncoder().encode(q).length,itemCount:1,metadata:{operation:"qa"}})}catch(e){return res.status(503).json({error:"Document Q&A is not configured yet.",detail:String(e.message||e).slice(0,300)})}
 const r=await db.query("SELECT dc.document_id,dc.chunk_index,dc.content,d.title,d.filename,1-(dv.embedding <=> $1::vector) AS similarity FROM document_vectors dv JOIN document_chunks dc ON dc.document_id=dv.document_id AND dc.chunk_index=dv.chunk_index JOIN documents d ON d.id=dv.document_id WHERE dv.user_id=$2 AND d.status='READY' ORDER BY dv.embedding <=> $1::vector LIMIT 12",[vec(vector),req.user.id]);
 const context=r.rows.filter(x=>Number(x.similarity)>=0.52).slice(0,5);
 if(!context.length)return res.json({answer:"The documents do not provide enough information.",sources:[],provider:null,model:null});
 const sourcePrompt=context.map((x,i)=>"[SOURCE "+(i+1)+"] "+x.title+" / "+x.filename+" / chunk "+x.chunk_index+"\n"+String(x.content||"").slice(0,3000)).join("\n\n");
 const answer=await generateText({model:"google.gemini",purpose:"document_qa",userId:req.user.id,system:"Answer using only the supplied document context. If the context does not contain the answer, say that the documents do not provide enough information. Cite sources inline as [Source N]. Prefer the strongest matching sources and do not cite unsupported claims.",prompt:"Question: "+q+"\n\nDocument context:\n"+sourcePrompt,responseStyle:"concise",cacheTtlSeconds:600});
 res.json({answer:answer.text,sources:context.map((x,i)=>({source:i+1,title:x.title,filename:x.filename,chunk_index:x.chunk_index,similarity:x.similarity,label:x.filename+" · chunk "+x.chunk_index})),provider:answer.provider,model:answer.model});
}