(()=>{
 const ensure=()=>{
  if(document.getElementById("sbModalRoot"))return;
  document.body.insertAdjacentHTML("beforeend",'<div id="sbModalRoot"></div><div id="sbToast" class="sb-toast" role="status" aria-live="polite"></div>');
 };
 function toast(message,type="info"){
  ensure();const t=document.getElementById("sbToast");t.textContent=String(message||"");t.dataset.type=type;t.classList.add("show");clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove("show"),2200);
 }
 function closeModal(value){
  const root=document.getElementById("sbModalRoot"),back=root?.querySelector(".sb-modal-backdrop");
  if(!back)return;
  const done=back._resolve;back.remove();done?.(value);
 }
 function confirmBox({title="Confirm",message="",confirmText="Confirm",danger=false}={}){
  ensure();return new Promise(resolve=>{
   const root=document.getElementById("sbModalRoot");
   root.innerHTML='<div class="sb-modal-backdrop"><section class="sb-modal-card" role="dialog" aria-modal="true" aria-labelledby="sbModalTitle"><div class="section-head"><h2 id="sbModalTitle">'+esc(title)+'</h2><button class="icon-btn" data-close aria-label="Close">×</button></div><p>'+esc(message)+'</p><div class="modal-actions"><button class="ghost" data-cancel>Cancel</button><button class="'+(danger?"danger-btn":"primary")+'" data-confirm>'+esc(confirmText)+'</button></div></section></div>';
   const back=root.firstElementChild;back._resolve=resolve;
   back.addEventListener("click",e=>{if(e.target===back)closeModal(false)});
   back.querySelector("[data-close]").onclick=()=>closeModal(false);back.querySelector("[data-cancel]").onclick=()=>closeModal(false);back.querySelector("[data-confirm]").onclick=()=>closeModal(true);
   back.querySelector("[data-confirm]").focus();
  });
 }
 function formBox({title="Add item",fields=[],submitText="Save"}={}){
  ensure();return new Promise(resolve=>{
   const root=document.getElementById("sbModalRoot");
   const body=fields.map((f,i)=>{
    const id="sbf"+i,label='<span>'+esc(f.label||f.name)+'</span>';
    if(f.type==="textarea")return '<label>'+label+'<textarea id="'+id+'" rows="'+(f.rows||4)+'" placeholder="'+esc(f.placeholder||"")+'">'+esc(f.value||"")+'</textarea></label>';
    if(f.type==="select")return '<label>'+label+'<select id="'+id+'">'+(f.options||[]).map(o=>'<option value="'+esc(o.value??o)+'" '+((f.value??"")===(o.value??o)?"selected":"")+'>'+esc(o.label??o)+'</option>').join("")+'</select></label>';
    return '<label>'+label+'<input id="'+id+'" type="'+esc(f.type||"text")+'" value="'+esc(f.value||"")+'" placeholder="'+esc(f.placeholder||"")+'" '+(f.required?"required":"")+'></label>';
   }).join("");
   root.innerHTML='<div class="sb-modal-backdrop"><section class="sb-modal-card" role="dialog" aria-modal="true" aria-labelledby="sbFormTitle"><div class="section-head"><h2 id="sbFormTitle">'+esc(title)+'</h2><button class="icon-btn" data-close aria-label="Close">×</button></div><form class="sb-form">'+body+'<div class="modal-actions"><button type="button" class="ghost" data-cancel>Cancel</button><button class="primary">'+esc(submitText)+'</button></div></form></section></div>';
   const back=root.firstElementChild;back._resolve=resolve;
   const done=v=>closeModal(v);
   back.querySelector("[data-close]").onclick=()=>done(null);back.querySelector("[data-cancel]").onclick=()=>done(null);back.addEventListener("click",e=>{if(e.target===back)done(null)});
   back.querySelector("form").onsubmit=e=>{e.preventDefault();const out={};fields.forEach((f,i)=>out[f.name]=back.querySelector("#sbf"+i).value);done(out)};
   setTimeout(()=>back.querySelector("input,textarea,select")?.focus(),0);
  });
 }
 window.SBUI={toast,confirm:confirmBox,form:formBox};
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&document.querySelector(".sb-modal-backdrop"))closeModal(null)});
 ensure();
})();