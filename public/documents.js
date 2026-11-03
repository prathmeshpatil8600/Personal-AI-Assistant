async function renderDocuments(root){
 const docs=await api("/documents/list")||[];
 root.innerHTML=shell("Documents",'<div class="card"><div class="section-head"><div><h2>Knowledge base</h2><div class="label">Upload text-based files and ask questions about them.</div></div><label class="primary" id="docUploadLabel" style="cursor:pointer">+ Upload<input id="docFile" type="file" accept=".pdf,.txt,.md,.csv,.json,.html,application/pdf,text/plain,text/markdown,text/csv,application/json,text/html" hidden></label></div><div id="docUploadStatus"></div><div class="list" id="docList">'+documentRows(docs)+'</div><div class="section"><div class="section-head"><h2>Ask your documents</h2><button class="primary" onclick="askDocuments()">Ask</button></div><textarea id="docQuestion" rows="4" placeholder="Ask something about your uploaded documents..."></textarea><div id="docAnswer" class="section"></div></div></div>');
 document.getElementById("docFile")?.addEventListener("change",e=>uploadDocument(e.target.files?.[0],root));
}
function documentRows(docs){
 return docs.length?docs.map(d=>'<div class="item"><div><b>'+esc(d.title)+'</b><div class="label">'+esc(d.filename)+' · '+esc(d.status)+'</div>'+(d.error_message?'<div class="label">'+esc(d.error_message)+'</div>':'')+'</div><button onclick="deleteDocument(\''+d.id+'\')">Delete</button></div>').join(""):'<div class="empty">No documents yet.</div>';
}
async function refreshDocumentList(root){
 const docs=await api("/documents/list")||[];
 const list=(root||document).querySelector?.("#docList")||document.getElementById("docList");
 if(list)list.innerHTML=documentRows(docs);
}
async function uploadDocument(file,root){
 if(!file)return;
 const status=document.getElementById("docUploadStatus"),label=document.getElementById("docUploadLabel"),input=document.getElementById("docFile");
 const optimisticId="upload-"+Date.now();
 if(status)status.innerHTML='<div class="doc-upload-progress" id="'+optimisticId+'"><div class="doc-upload-spinner"></div><div><b>Uploading '+esc(file.name)+'</b><span>Uploading and preparing this document for search. You can stay on this page.</span></div></div>';
 if(label){label.classList.add("is-busy");label.setAttribute("aria-busy","true")}
 if(input)input.disabled=true;
 const fd=new FormData();fd.append("file",file);
 try{
  const r=await fetch("/api/documents/upload",{method:"POST",body:fd});
  const d=await r.json();
  if(!r.ok)throw new Error(d.error||d.detail||"Upload failed");
  await refreshDocumentList(root||document.getElementById("content"));
  if(status)status.innerHTML='<div class="doc-upload-success"><span>✓</span><div><b>'+esc(file.name)+' is ready</b><small>'+(Number(d.chunks)||0)+' searchable sections created.</small></div></div>';
  window.SecondBrainToast?.("Document uploaded and ready");
  setTimeout(()=>{if(status)status.innerHTML=""},3500);
 }catch(e){
  if(status)status.innerHTML='<div class="doc-upload-error"><span>!</span><div><b>Upload failed</b><small>'+esc(e.message||"Unable to process this document.")+'</small></div></div>';
 }finally{
  if(label){label.classList.remove("is-busy");label.removeAttribute("aria-busy")}
  if(input){input.disabled=false;input.value=""}
 }
}
async function deleteDocument(id){if(!confirm("Delete this document?"))return;await api("/documents/delete?id="+encodeURIComponent(id),{method:"DELETE"});await refreshDocumentList(document.getElementById("content"))}
async function askDocuments(){const q=document.getElementById("docQuestion").value.trim();if(!q)return;const box=document.getElementById("docAnswer");box.innerHTML='<div class="label">Searching documents…</div>';try{const d=await api("/documents/ask",{method:"POST",body:JSON.stringify({query:q})});box.innerHTML='<div class="card"><div class="label">Answer · '+esc(d.provider)+' / '+esc(d.model)+'</div><p>'+esc(d.answer).replace(/\n/g,"<br>")+'</p></div>'}catch(e){box.innerHTML='<div class="card"><p class="label">'+esc(e.message)+'</p></div>'}}