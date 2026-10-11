let memoryCache=[];
const memoryGroups=[["about","About you"],["project","Projects"],["goal","Goals"],["preference","Preferences"],["chat","Saved from chat"],["general","Other"]];

function normalizeMemoryGroup(category){
 const c=String(category||"general").toLowerCase();
 if(c.includes("project"))return"project";
 if(c.includes("goal"))return"goal";
 if(c.includes("preference"))return"preference";
 if(c.includes("about")||c.includes("profile")||c.includes("personal"))return"about";
 if(c.includes("chat"))return"chat";
 return"general";
}

async function renderMemory(root){
 memoryCache=await api("/memories/list")||[];
 const grouped=Object.fromEntries(memoryGroups.map(([k])=>[k,[]]));
 memoryCache.forEach(m=>grouped[normalizeMemoryGroup(m.category)].push(m));
 const sections=memoryGroups.map(([key,label])=>{
  const rows=grouped[key];
  if(!rows.length)return"";
  return '<section class="memory-group"><div class="memory-group-head"><h2>'+label+'</h2><span class="label">'+rows.length+' saved</span></div><div class="memory-grid">'+rows.map(memoryCard).join("")+'</div></section>';
 }).join("");
 root.innerHTML='<div class="top memory-top"><div><div class="eyebrow">Knowledge about you</div><h1>Memory</h1><p class="label">Review, edit, or forget what SecondBrain can reuse in future conversations.</p></div><button class="primary" id="addMemoryBtn">+ Add memory</button></div>'+
 '<div class="memory-summary card"><div><b>'+memoryCache.length+'</b><span>Saved memories</span></div><div><b>'+memoryCache.filter(m=>Number(m.importance)>=4).length+'</b><span>High importance</span></div><div><b>'+memoryCache.filter(m=>m.last_accessed_at).length+'</b><span>Used before</span></div></div>'+
 (sections||'<div class="empty-state"><div class="empty-icon">◇</div><h3>No saved memories yet</h3><p class="label">Add preferences, projects, goals, or personal context you want the assistant to remember.</p></div>')+
 memoryEditorHTML();
 document.getElementById("addMemoryBtn").onclick=()=>openMemoryEditor();
 root.querySelectorAll("[data-memory-edit]").forEach(b=>b.onclick=()=>openMemoryEditor(b.dataset.memoryEdit));
 root.querySelectorAll("[data-memory-delete]").forEach(b=>b.onclick=()=>forgetMemory(b.dataset.memoryDelete));
 window.SecondBrainShell?.setContext("Memory");
}

function memoryCard(m){
 const used=m.last_accessed_at?new Date(m.last_accessed_at).toLocaleDateString([],{month:"short",day:"numeric"}):"Not used yet";
 const importance=Math.max(1,Math.min(5,Number(m.importance)||3));
 return '<article class="memory-card living-memory-node" data-memory-group="'+esc(normalizeMemoryGroup(m.category))+'" data-importance="'+importance+'"><span class="memory-node-core" aria-hidden="true"></span><div class="memory-card-head"><span class="pill">'+esc(m.category||"general")+'</span><span class="memory-importance" title="Importance">'+("●".repeat(importance))+'</span></div><h3>'+esc(m.memory_key)+'</h3><p>'+esc(m.memory_value)+'</p><div class="memory-meta"><span>Last used: '+esc(used)+'</span><span>'+(Number(m.access_count)||0)+' uses</span></div><div class="memory-actions"><button class="ghost" data-memory-edit="'+m.id+'">Edit</button><button class="ghost danger-text" data-memory-delete="'+m.id+'">Forget</button></div></article>';
}

function memoryEditorHTML(){
 return '<div class="modal-backdrop" id="memoryEditor" hidden><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="memoryEditorTitle"><div class="section-head"><div><div class="eyebrow">Memory control</div><h2 id="memoryEditorTitle">Add memory</h2></div><button class="icon-btn" id="closeMemoryEditor" aria-label="Close">×</button></div><form id="memoryForm" class="memory-form"><input type="hidden" id="memoryId"><label>Category<select id="memoryCategory"><option value="about">About you</option><option value="project">Project</option><option value="goal">Goal</option><option value="preference">Preference</option><option value="general">Other</option></select></label><label>Memory name<input id="memoryKey" maxlength="160" placeholder="e.g. Preferred coding language" required></label><label>What should SecondBrain remember?<textarea id="memoryValue" rows="5" maxlength="4000" required></textarea></label><label>Importance<select id="memoryImportance"><option value="2">Low</option><option value="3" selected>Normal</option><option value="4">High</option><option value="5">Very high</option></select></label><div class="modal-actions"><button type="button" class="ghost" id="cancelMemoryEditor">Cancel</button><button class="primary">Save memory</button></div></form></section></div>';
}

function openMemoryEditor(id){
 const modal=document.getElementById("memoryEditor"),m=memoryCache.find(x=>x.id===id);
 document.getElementById("memoryEditorTitle").textContent=m?"Edit memory":"Add memory";
 document.getElementById("memoryId").value=m?.id||"";
 document.getElementById("memoryCategory").value=normalizeMemoryGroup(m?.category||"preference");
 document.getElementById("memoryKey").value=m?.memory_key||"";
 document.getElementById("memoryValue").value=m?.memory_value||"";
 document.getElementById("memoryImportance").value=String(m?.importance||3);
 modal.hidden=false;
 document.getElementById("memoryKey").focus();
 document.getElementById("closeMemoryEditor").onclick=closeMemoryEditor;
 document.getElementById("cancelMemoryEditor").onclick=closeMemoryEditor;
 document.getElementById("memoryForm").onsubmit=saveMemoryEditor;
 modal.onclick=e=>{if(e.target===modal)closeMemoryEditor()};
}

function closeMemoryEditor(){const m=document.getElementById("memoryEditor");if(m)m.hidden=true}

async function saveMemoryEditor(e){
 e.preventDefault();
 const id=document.getElementById("memoryId").value;
 const body={id,category:document.getElementById("memoryCategory").value,memory_key:document.getElementById("memoryKey").value.trim(),memory_value:document.getElementById("memoryValue").value.trim(),importance:Number(document.getElementById("memoryImportance").value),source:"user"};
 if(!body.memory_key||!body.memory_value)return;
 await api(id?"/memories/update":"/memories/save",{method:"POST",body:JSON.stringify(body)});
 closeMemoryEditor();await renderMemory(document.getElementById("content"));
}

async function forgetMemory(id){
 const m=memoryCache.find(x=>x.id===id);
 if(!confirm('Forget "'+(m?.memory_key||"this memory")+'"?'))return;
 await api("/memories/delete",{method:"POST",body:JSON.stringify({id})});
 await renderMemory(document.getElementById("content"));
}