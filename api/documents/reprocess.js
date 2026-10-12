import { db, storage } from "hatchable";
import { embedText } from "../../lib/gemini-embed.js";
import { extractPdfText } from "../../lib/pdf-text.js";
import { recordUsageEvent } from "../../lib/usage-meter.js";
import { requireFeature,requireUnits,entitlementError } from "../../lib/entitlements.js";
export const access="user";
export const methods=["POST"];
function cleanText(s){return s.replace(/\r\n/g,"\n").replace(/\r/g,"\n").replace(/\u0000/g,"").trim()}
function chunks(s,size=1800,overlap=200){const out=[];let i=0;while(i<s.length){const part=s.slice(i,i+size).trim();if(part)out.push(part);if(i+size>=s.length)break;i+=size-overlap}return out}
function vec(v){return "["+v.join(",")+"]"}
export default async function(req,res){
 const id=typeof req.body?.id==="string"?req.body.id.trim():"";if(!id)return res.status(400).json({error:"Document id is required."});const featureGate=await requireFeature(req.user.id,"documents");if(!featureGate.ok)return entitlementError(res,featureGate);
 const r=await db.query("SELECT id,title,filename,content_type,storage_key FROM documents WHERE id=$1 AND user_id=$2",[id,req.user.id]);if(!r.rows.length)return res.status(404).json({error:"Document not found."});
 const doc=r.rows[0];
 try{
  const stored=await storage.get(doc.storage_key);const unitGate=await requireUnits(req.user.id,Math.max(1,Math.ceil((stored.buffer?.length||0)/(1024*1024))+1));if(!unitGate.ok)return entitlementError(res,unitGate);await db.query("UPDATE documents SET status='PROCESSING',error_message=NULL,updated_at=now() WHERE id=$1 AND user_id=$2",[id,req.user.id]);const text=cleanText(await extractPdfText(stored.buffer));if(!text)throw new Error("The PDF contains no extractable text.");const parts=chunks(text);
  await db.query("DELETE FROM document_vectors WHERE document_id=$1 AND user_id=$2",[id,req.user.id]);await db.query("DELETE FROM document_chunks WHERE document_id=$1 AND user_id=$2",[id,req.user.id]);
  for(let i=0;i<parts.length;i++){await db.query("INSERT INTO document_chunks(document_id,user_id,chunk_index,content) VALUES($1,$2,$3,$4)",[id,req.user.id,i,parts[i]]);const vector=await embedText(parts[i],"RETRIEVAL_DOCUMENT",doc.title);await db.query("INSERT INTO document_vectors(document_id,user_id,chunk_index,embedding) VALUES($1,$2,$3,$4::vector)",[id,req.user.id,i,vec(vector)])}
  await db.query("UPDATE documents SET status='READY',error_message=NULL,updated_at=now() WHERE id=$1 AND user_id=$2",[id,req.user.id]);await recordUsageEvent({userId:req.user.id,eventKey:"document-reprocess:"+id+":"+crypto.randomUUID(),eventType:"document_ingest",source:"document",provider:"google",model:"pdf-extraction+gemini-embedding-001",documentId:id,bytesProcessed:stored.buffer?.length||0,itemCount:parts.length,metadata:{reprocess:true,status:"COMPLETED"}});return res.json({success:true,id,status:"READY",chunks:parts.length,preview:text.slice(0,500)});
 }catch(e){await db.query("UPDATE documents SET status='ERROR',error_message=$1,updated_at=now() WHERE id=$2 AND user_id=$3",[String(e.message||e).slice(0,1000),id,req.user.id]);return res.status(500).json({error:"Document reprocessing failed.",detail:String(e.message||e).slice(0,500)})}
}