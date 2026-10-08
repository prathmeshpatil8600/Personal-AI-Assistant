import { db, storage } from "hatchable";
import { embedText } from "../../lib/gemini-embed.js";
import { extractPdfText } from "../../lib/pdf-text.js";
import { recordUsageEvent } from "../../lib/usage-meter.js";
import { requireFeature,requireUnits,requireCountLimit,entitlementError } from "../../lib/entitlements.js";
export const access="member";
export const methods=["POST"];
function decode(buffer){return new TextDecoder().decode(buffer)}
function cleanText(s){return s.replace(/\r\n/g,"\n").replace(/\r/g,"\n").replace(/\u0000/g,"").trim()}
function chunks(s,size=1800,overlap=200){const out=[];let i=0;while(i<s.length){const part=s.slice(i,i+size).trim();if(part)out.push(part);if(i+size>=s.length)break;i+=size-overlap}return out}
function vec(v){return "["+v.join(",")+"]"}
export default async function(req,res){
 const member=req.member,file=req.files?.[0];if(!file)return res.status(400).json({error:"Upload a document file."});
 const filename=file.filename||"document",ext=(filename.split(".").pop()||"").toLowerCase(),isPdf=file.contentType==="application/pdf"||ext==="pdf";
 const allowed=["text/plain","text/markdown","text/csv","application/json","text/html"];
 if(!isPdf&&!allowed.includes(file.contentType))return res.status(415).json({error:"Supported formats: PDF, TXT, Markdown, CSV, JSON, and HTML."});
 if((file.buffer?.length||0)>20*1024*1024)return res.status(413).json({error:"Document is too large. Maximum upload size is 20 MB."});
 const featureGate=await requireFeature(member.id,"documents");if(!featureGate.ok)return entitlementError(res,featureGate);
 const docCount=Number((await db.query("SELECT count(*)::int AS n FROM documents WHERE user_id=$1",[member.id])).rows[0]?.n||0);const countGate=await requireCountLimit(member.id,"max_documents",docCount);if(!countGate.ok)return entitlementError(res,countGate);
 const unitGate=await requireUnits(member.id,Math.max(1,Math.ceil((file.buffer?.length||0)/(1024*1024))+1));if(!unitGate.ok)return entitlementError(res,unitGate);
 const title=filename.replace(/\.[^.]+$/," ").trim().slice(0,200),key="documents/"+member.id+"/"+crypto.randomUUID()+"-"+filename;
 await storage.put(key,file.buffer,file.contentType||"application/octet-stream");
 const doc=(await db.query("INSERT INTO documents(user_id,title,filename,content_type,storage_key,status) VALUES($1,$2,$3,$4,$5,'PROCESSING') RETURNING id,title,filename,status,created_at",[member.id,title,filename,file.contentType||"application/octet-stream",key])).rows[0];
 try{
  const text=cleanText(isPdf?await extractPdfText(file.buffer):decode(file.buffer));if(!text)throw new Error("The document contains no extractable text.");
  const parts=chunks(text);
  for(let i=0;i<parts.length;i++){
   await db.query("INSERT INTO document_chunks(document_id,user_id,chunk_index,content) VALUES($1,$2,$3,$4)",[doc.id,member.id,i,parts[i]]);
   const vector=await embedText(parts[i],"RETRIEVAL_DOCUMENT",title);
   await db.query("INSERT INTO document_vectors(document_id,user_id,chunk_index,embedding) VALUES($1,$2,$3,$4::vector)",[doc.id,member.id,i,vec(vector)]);
  }
  await db.query("UPDATE documents SET status='READY',error_message=NULL,updated_at=now() WHERE id=$1 AND user_id=$2",[doc.id,member.id]);
  await recordUsageEvent({userId:member.id,eventKey:"document-ingest:"+doc.id,eventType:"document_ingest",source:"document",provider:"google",model:isPdf?"pdf-extraction+gemini-embedding-001":"gemini-embedding-001",documentId:doc.id,bytesProcessed:file.buffer?.length||0,itemCount:parts.length,metadata:{content_type:file.contentType||null,is_pdf:isPdf,status:"COMPLETED"}});
  res.status(201).json({...doc,status:"READY",chunks:parts.length});
 }catch(e){
  await db.query("DELETE FROM document_vectors WHERE document_id=$1 AND user_id=$2",[doc.id,member.id]).catch(()=>{});
  await db.query("DELETE FROM document_chunks WHERE document_id=$1 AND user_id=$2",[doc.id,member.id]).catch(()=>{});
  await db.query("UPDATE documents SET status='ERROR',error_message=$1,updated_at=now() WHERE id=$2 AND user_id=$3",[String(e.message||e).slice(0,1000),doc.id,member.id]);
  res.status(500).json({error:"Document processing failed.",document_id:doc.id,detail:String(e.message||e).slice(0,500)});
 }
}