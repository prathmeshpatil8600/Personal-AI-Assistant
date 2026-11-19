(function(){
 function ensureUI(){
  if(!document.getElementById("globalUiModal")){
   document.body.insertAdjacentHTML("beforeend",'<div class="modal-backdrop polish-modal" id="globalUiModal" hidden><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="globalUiTitle"><div class="section-head"><div><div class="eyebrow" id="globalUiEyebrow">SecondBrain</div><h2 id="globalUiTitle">Action</h2></div><button class="icon-btn" id="globalUiClose" aria-label="Close">×</button></div><form id="globalUiForm" class="memory-form"><div id="globalUiFields"></div><div class="modal-actions"><button type="button" class="ghost" id="globalUiCancel">Cancel</button><button class="primary" id="globalUiSubmit">Save</button></div></form></section></div>');
  }
  if(!document.getElementById("globalToast")){
   const t=document.createElement("div");t.id="globalToast";t.className="chat-toast";t.setAttribute("role","status");t.setAttribute("aria-live","polite");document.body.appendChild(t);
  }
 }

 function toast(message){
  ensureUI();const t=document.getElementById("globalToast");t.textContent=message;t.classList.add("show");clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove("show"),2200);
 }
 window.SecondBrainToast=toast;

 function fieldHtml(f){
  if(f.type==="textarea")return '<label>'+esc(f.label)+'<textarea name="'+esc(f.name)+'" rows="'+(f.rows||4)+'" '+(f.required?"required":"")+' placeholder="'+esc(f.placeholder||"")+'">'+esc(f.value||"")+'</textarea></label>';
  if(f.type==="select")return '<label>'+esc(f.label)+'<select name="'+esc(f.name)+'">'+(f.options||[]).map(o=>'<option value="'+esc(o.value)+'" '+(String(o.value)===String(f.value)?"selected":"")+'>'+esc(o.label)+'</option>').join("")+'</select></label>';
  return '<label>'+esc(f.label)+'<input name="'+esc(f.name)+'" type="'+esc(f.type||"text")+'" '+(f.required?"required":"")+' value="'+esc(f.value||"")+'" placeholder="'+esc(f.placeholder||"")+'"></label>';
 }

 function formDialog({title,eyebrow="Create",submit="Save",fields=[],html=""}){
  ensureUI();
  const modal=document.getElementById("globalUiModal"),form=document.getElementById("globalUiForm");
  document.getElementById("globalUiTitle").textContent=title;
  document.getElementById("globalUiEyebrow").textContent=eyebrow;
  document.getElementById("globalUiSubmit").textContent=submit;
  document.getElementById("globalUiFields").innerHTML=html||fields.map(fieldHtml).join("");
  modal.hidden=false;
  const first=form.querySelector("input,textarea,select");setTimeout(()=>first?.focus(),0);
  return new Promise(resolve=>{
   const close=v=>{modal.hidden=true;resolve(v)};
   document.getElementById("globalUiClose").onclick=()=>close(null);
   document.getElementById("globalUiCancel").onclick=()=>close(null);
   modal.onclick=e=>{if(e.target===modal)close(null)};
   form.onsubmit=e=>{e.preventDefault();const fd=new FormData(form),out={};for(const [k,v] of fd.entries())out[k]=String(v).trim();close(out)};
  });
 }
 window.SecondBrainDialog=formDialog;

 const originalOpen=window.openSection;
 if(typeof originalOpen==="function"){
  window.openSection=async function(id){
   const root=document.getElementById("content");
   if(root){root.setAttribute("aria-busy","true");root.classList.add("content-loading")}
   try{return await originalOpen(id)}
   finally{if(root){root.setAttribute("aria-busy","false");root.classList.remove("content-loading")}}
  };
 }

 window.newTask=async function(){
  const v=await formDialog({title:"New task",fields:[
   {name:"title",label:"Task title",required:true,placeholder:"What needs to be done?"},
   {name:"description",label:"Description",type:"textarea",rows:3,placeholder:"Optional context"},
   {name:"priority",label:"Priority",type:"select",value:"MEDIUM",options:[{value:"LOW",label:"Low"},{value:"MEDIUM",label:"Medium"},{value:"HIGH",label:"High"},{value:"URGENT",label:"Urgent"}]}
  ]});
  if(!v)return;await api("/tasks/create",{method:"POST",body:JSON.stringify(v)});toast("Task created");openSection("tasks");
 };

 window.newNote=async function(){
  const v=await formDialog({title:"New note",fields:[
   {name:"title",label:"Note title",required:true,placeholder:"Title"},
   {name:"content",label:"Note",type:"textarea",rows:6,placeholder:"Write your note…"}
  ]});
  if(!v)return;await api("/notes/create",{method:"POST",body:JSON.stringify(v)});toast("Note saved");openSection("notes");
 };

 window.newReminder=async function(){
  const v=await formDialog({title:"New reminder",fields:[
   {name:"title",label:"Reminder",required:true,placeholder:"What should I remind you about?"},
   {name:"remind_at",label:"When",type:"datetime-local",required:true}
  ]});
  if(!v)return;await api("/reminders/create",{method:"POST",body:JSON.stringify({title:v.title,remind_at:new Date(v.remind_at).toISOString()})});toast("Reminder scheduled");openSection("reminders");
 };

 window.newCalendarEvent=async function(){
  const v=await formDialog({title:"New calendar event",fields:[
   {name:"title",label:"Event title",required:true,placeholder:"Event name"},
   {name:"start_at",label:"Starts",type:"datetime-local",required:true},
   {name:"end_at",label:"Ends",type:"datetime-local"},
   {name:"location",label:"Location",placeholder:"Optional"}
  ]});
  if(!v)return;
  const body={title:v.title,start_at:new Date(v.start_at).toISOString(),end_at:v.end_at?new Date(v.end_at).toISOString():null,location:v.location||null};
  await api("/calendar/create",{method:"POST",body:JSON.stringify(body)});toast("Event created");openSection("calendar");
 };

 window.createGoal=async function(){
  const v=await formDialog({title:"New goal",fields:[
   {name:"title",label:"Goal title",required:true,placeholder:"What do you want to achieve?"},
   {name:"description",label:"What does success look like?",type:"textarea",rows:4},
   {name:"target_date",label:"Target date",type:"date"}
  ]});
  if(!v)return;await api("/goals/create",{method:"POST",body:JSON.stringify({title:v.title,description:v.description||"",target_date:v.target_date||null})});toast("Goal created");openSection("goals");
 };

 window.createHabit=async function(){
  const v=await formDialog({title:"New habit",fields:[
   {name:"name",label:"Routine name",required:true,placeholder:"e.g. Read for 20 minutes"},
   {name:"frequency",label:"Frequency",type:"select",value:"DAILY",options:[{value:"DAILY",label:"Daily"},{value:"WEEKLY",label:"Weekly"}]}
  ]});
  if(!v)return;await api("/habits/create",{method:"POST",body:JSON.stringify(v)});toast("Habit created");openSection("goals");
 };

 window.planGoal=async function(id){
  try{
   const d=await api("/goals/plan",{method:"POST",body:JSON.stringify({id})});
   const items=(d.tasks||[]).map((t,i)=>'<li><b>'+esc(t.title)+'</b><span class="pill">'+esc(t.priority)+'</span></li>').join("");
   return await formDialog({title:"Suggested goal plan",eyebrow:d.ai_available?"AI plan":"Built-in plan",submit:"Close",html:'<div class="plan-preview"><ol>'+items+'</ol>'+(d.ai_available?"":'<p class="label">AI planning is unavailable, so this is the built-in fallback plan.</p>')+'</div>'});
  }catch(e){toast(e.message)}
 };

 const originalVoice=window.startVoiceInput;
 window.startVoiceInput=function(inputId){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){toast("Voice input is not supported in this browser.");return}
  try{
   const input=document.getElementById(inputId),rec=new SR();rec.lang="en-IN";rec.interimResults=true;rec.continuous=false;
   rec.onstart=()=>toast("Listening…");
   rec.onresult=e=>{let t="";for(let i=e.resultIndex;i<e.results.length;i++)t+=e.results[i][0].transcript;input.value=t;input.dispatchEvent(new Event("input",{bubbles:true}))};
   rec.onerror=e=>{if(e.error!=="aborted")toast("Voice input error: "+e.error)};
   rec.start();
  }catch(e){if(originalVoice)originalVoice(inputId);else toast("Voice input could not start.")}
 };

 document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
   const modal=document.getElementById("globalUiModal");
   if(modal&&!modal.hidden){document.getElementById("globalUiCancel")?.click()}
  }
 });

 ensureUI();
})();