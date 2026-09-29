import { db, storage, ai, knowledge } from "hatchable";
export const access="member";
export const methods=["POST"];

function decode(buffer){return new TextDecoder().decode(buffer)}
function cleanText(s){return s.replace(/\r\n/g,"\n").replace(/\r/g,"\n").replace(/\u0000/g,"").trim()}
function chunks(s,size=1800,overlap=200){const out=[];let i=0;while(i<s.length){const part=s.slice(i,i+size).trim();if(part)out.push(part);if(i+size>=s.length)break;i+=size-overlap}return out}

export default async function(req,res){
 const member=req.member, file=req.files?.[0];
 if(!file)return res.status(400).json({error:"Upload a document file."});
 const allowed=["text/plain","text/markdown","text/csv","application/json","text/html"];
 if(!allowed.includes(file.contentType))return res.status(415).json({error:"Phase 4 currently supports TXT, Markdown, CSV, JSON, and HTML text extraction."});
 const title=(file.filename||"Untitled").replace(/\.[^.]+$/,"").slice(0,200);
 const key="documents/"+member.id+"/"+crypto.randomUUID()+"-"+(file.filename||"document");
 await storage.put(key,file.buffer,file.contentType);
 const doc=(await db.query("INSERT INTO documents(user_id,title,filename,content_type,storage_key,status) VALUES($1,$2,$3,$4,$5,'PROCESSING') RETURNING id,title,filename,status,created_at",[member.id,title,file.filename,file.contentType,key])).rows[0];
 try{
  const text=cleanText(decode(file.buffer));
  if(!text)throw new Error("The document contains no extractable text.");
  const parts=chunks(text);
  for(let i=0;i<parts.length;i++)await db.query("INSERT INTO document_chunks(document_id,user_id,chunk_index,content) VALUES($1,$2,$3,$4)",[doc.id,member.id,i,parts[i]]);
  const base=knowledge.base("documents_"+member.id,{dimensions:1536});
  for(let i=0;i<parts.length;i++){const emb=await ai.embed(parts[i]);await base.add({id:doc.id+":"+i,vector:emb.embedding,content:parts[i],metadata:{document_id:doc.id,user_id:member.id,chunk_index:i,title}})}
  await db.query("UPDATE documents SET status='READY',updated_at=now() WHERE id=$1 AND user_id=$2",[doc.id,member.id]);
  res.status(201).json({...doc,status:"READY",chunks:parts.length});
 }catch(e){
  await db.query("UPDATE documents SET status='ERROR',error_message=$1,updated_at=now() WHERE id=$2 AND user_id=$3",[String(e.message||e).slice(0,1000),doc.id,member.id]);
  res.status(500).json({error:"Document processing failed.",document_id:doc.id,detail:String(e.message||e).slice(0,300)});
 }
}