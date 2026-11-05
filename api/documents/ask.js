import { db } from "hatchable";
import { embedText } from "../../lib/gemini-embed.js";
import { generateText } from "../../lib/ai-router.js";
import { recordUsageEvent } from "../../lib/usage-meter.js";
import { requireFeature,requireUnits,entitlementError } from "../../lib/entitlements.js";
import { enforceUserRateLimit,rateLimitError } from "../../lib/rate-limit.js";
export const access="user"; export const methods=["POST"];

function vec(v){return "["+v.join(",")+"]"}
function terms(s){return new Set(String(s||"").toLowerCase().match(/[a-z0-9_]{3,}/g)||[])}
function lexicalScore(query,content){
 const q=terms(query),c=terms(content);if(!q.size||!c.size)return 0;
 let hit=0;for(const t of q)if(c.has(t))hit++;
 return hit/q.size;
}

export default async function(req,res){
 const rate=await enforceUserRateLimit(req.user.id,"document_qa",{limit:20,windowSeconds:60});if(!rate.ok)return rateLimitError(res,rate);
 const q=typeof req.body?.query==="string"?req.body.query.trim():"";
 if(!q)return res.status(400).json({error:"query is required."});
 const featureGate=await requireFeature(req.user.id,"documents");if(!featureGate.ok)return entitlementError(res,featureGate);
 const unitGate=await requireUnits(req.user.id,2);if(!unitGate.ok)return entitlementError(res,unitGate);

 let vector;
 try{
  vector=await embedText(q,"RETRIEVAL_QUERY");
  await recordUsageEvent({userId:req.user.id,eventKey:"embedding-query:"+crypto.randomUUID(),eventType:"embedding_query",source:"document",provider:"google",model:"gemini-embedding-001",bytesProcessed:new TextEncoder().encode(q).length,itemCount:1,metadata:{operation:"qa"}});
 }catch(e){
  return res.status(503).json({error:"Document Q&A is not configured yet.",detail:String(e.message||e).slice(0,300)});
 }

 const r=await db.query("SELECT dc.document_id,dc.chunk_index,dc.content,d.title,d.filename,1-(dv.embedding <=> $1::vector) AS similarity FROM document_vectors dv JOIN document_chunks dc ON dc.document_id=dv.document_id AND dc.chunk_index=dv.chunk_index JOIN documents d ON d.id=dv.document_id WHERE dv.user_id=$2 AND d.status='READY' ORDER BY dv.embedding <=> $1::vector LIMIT 10",[vec(vector),req.user.id]);

 const ranked=r.rows
  .filter(x=>Number(x.similarity)>=0.50)
  .map(x=>({...x,lexical:lexicalScore(q,x.content)}))
  .sort((a,b)=>(Number(b.similarity)*0.82+b.lexical*0.18)-(Number(a.similarity)*0.82+a.lexical*0.18))
  .slice(0,4);

 if(!ranked.length)return res.json({answer:"The documents do not provide enough information.",sources:[],provider:null,model:null});

 const sourcePrompt=ranked.map((x,i)=>"[SOURCE "+(i+1)+"] "+x.title+" / "+x.filename+" / chunk "+x.chunk_index+"\n"+String(x.content||"").slice(0,2400)).join("\n\n");
 const answer=await generateText({
  model:"google.gemini",
  purpose:"document_qa",
  userId:req.user.id,
  system:"Answer using only the supplied document context. If the context does not contain the answer, say that the documents do not provide enough information. Cite sources inline as [Source N]. Prefer the strongest matching sources. Keep the answer concise unless the user explicitly requests detail.",
  prompt:"Question: "+q+"\n\nDocument context:\n"+sourcePrompt,
  responseStyle:"concise",
  cacheTtlSeconds:600
 });
 res.json({
  answer:answer.text,
  sources:ranked.map((x,i)=>({source:i+1,title:x.title,filename:x.filename,chunk_index:x.chunk_index,similarity:x.similarity,label:x.filename+" · chunk "+x.chunk_index})),
  provider:answer.provider,
  model:answer.model,
  context:{retrieved_candidates:r.rows.length,used_chunks:ranked.length,mode:"reranked"}
 });
}