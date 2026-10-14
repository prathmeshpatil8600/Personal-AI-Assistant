(()=>{
const STEPS=[
 {id:"chat",title:"Ask your assistant",copy:"Open Chat and ask one useful question.",section:"chat"},
 {id:"task",title:"Create a task",copy:"Add one task you want SecondBrain to track.",section:"tasks"},
 {id:"memory",title:"Save a memory",copy:"Store one preference or fact you want remembered.",section:"memory"},
 {id:"document",title:"Try a document",copy:"Upload or review a document.",section:"documents"},
 {id:"integration",title:"Connect an integration",copy:"Connect Google or GitHub when useful.",section:"integrations"}
];
function render(state){
 const existing=document.getElementById("pilotOnboardingCard");if(existing)existing.remove();
 if(!state||state.status==="COMPLETED"||state.status==="SKIPPED")return;
 const done=new Set(Array.isArray(state.completed_steps)?state.completed_steps:[]);
 const card=document.createElement("section");card.id="pilotOnboardingCard";card.className="card";card.style.margin="0 0 18px";
 card.innerHTML='<div class="section-head"><div><div class="eyebrow">Closed pilot</div><h2>Get value from SecondBrain in your first session</h2><span class="label">Complete any three steps. You can skip this checklist at any time.</span></div><button class="secondary" id="pilotSkip">Skip</button></div><div class="settings-links">'+
 STEPS.map(s=>'<button class="settings-link" data-pilot-step="'+s.id+'" data-section="'+s.section+'"><span><b>'+(done.has(s.id)?"✓ ":"")+s.title+'</b><small>'+s.copy+'</small></span><span>→</span></button>').join("")+'</div>';
 const root=document.getElementById("content");root?.prepend(card);
 card.querySelectorAll("[data-pilot-step]").forEach(b=>b.onclick=async()=>{window.openSection?.(b.dataset.section)});
 document.getElementById("pilotSkip").onclick=async()=>{try{await api("/pilot/onboarding",{method:"POST",body:JSON.stringify({action:"skip"})});card.remove()}catch{}};
}
async function refresh(){try{const s=await api("/pilot/onboarding");render(s)}catch{}}
async function mark(step){try{const s=await api("/pilot/onboarding",{method:"POST",body:JSON.stringify({step})});render(s)}catch{}}
window.SecondBrainPilot={refresh,mark};
})();