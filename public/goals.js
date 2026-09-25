async function renderGoals(root){
 const goals=await api("/goals/list")||[], habits=await api("/habits/list")||[];
 root.innerHTML=shell("Goals & routines",`
 <div class="grid">
  <div class="card"><div class="label">Active goals</div><div class="metric">${goals.filter(g=>g.status==="ACTIVE").length}</div></div>
  <div class="card"><div class="label">Average progress</div><div class="metric">${goals.length?Math.round(goals.reduce((a,g)=>a+Number(g.progress_percent),0)/goals.length):0}%</div></div>
  <div class="card"><div class="label">Active routines</div><div class="metric">${habits.filter(h=>h.active).length}</div></div>
 </div>
 <div class="section card"><div class="section-head"><h2>Goals</h2><button class="primary" id="newGoal">+ New goal</button></div>
 <div class="list">${goals.length?goals.map(g=>`<div class="item"><div><b>${esc(g.title)}</b><div class="label">${esc(g.description||"")} · ${esc(g.category)}</div><div class="progress"><span style="width:${Number(g.progress_percent)}%"></span></div></div><div><span class="pill">${Number(g.progress_percent)}%</span> <button class="ghost" data-plan="${g.id}">Plan</button> <button class="ghost" data-advance="${g.id}">+10%</button></div></div>`).join(""):'<div class="empty">No goals yet.</div>'}</div></div>
 <div class="section card"><div class="section-head"><h2>Routines</h2><button class="primary" id="newHabit">+ New routine</button></div>
 <div class="list">${habits.length?habits.map(h=>`<div class="item"><div><b>${esc(h.name)}</b><div class="label">${esc(h.frequency)} · streak ${h.current_streak}</div></div><button class="ghost" data-habit="${h.id}">Done today</button></div>`).join(""):'<div class="empty">No routines yet.</div>'}</div></div>`);
 document.getElementById("newGoal").onclick=createGoal;
 document.getElementById("newHabit").onclick=createHabit;
 document.querySelectorAll("[data-plan]").forEach(b=>b.onclick=()=>planGoal(b.dataset.plan));
 document.querySelectorAll("[data-advance]").forEach(b=>b.onclick=async()=>{const g=goals.find(x=>x.id===b.dataset.advance);await advanceGoal(g.id,Math.min(100,Number(g.progress_percent)+10))});
 document.querySelectorAll("[data-habit]").forEach(b=>b.onclick=()=>completeHabit(b.dataset.habit));
}
async function createGoal(){const title=prompt("Goal title");if(!title)return;const description=prompt("What does success look like?")||"";const target_date=prompt("Target date (YYYY-MM-DD), optional")||null;await api("/goals/create",{method:"POST",body:JSON.stringify({title,description,target_date})});openSection("goals")}
async function advanceGoal(id,p){await api("/goals/update",{method:"POST",body:JSON.stringify({id,progress_percent:p,status:p>=100?"COMPLETED":"ACTIVE"})});openSection("goals")}
async function planGoal(id){const d=await api("/goals/plan",{method:"POST",body:JSON.stringify({id})});const msg=d.tasks.map((t,i)=>(i+1)+". "+t.title+" ["+t.priority+"]").join("\n");alert("Suggested plan:\n\n"+msg+(d.ai_available?"":"\n\nAI planning is waiting for the provider key; this is the built-in fallback plan."))}
async function createHabit(){const name=prompt("Routine name");if(!name)return;await api("/habits/create",{method:"POST",body:JSON.stringify({name,frequency:"DAILY"})});openSection("goals")}
async function completeHabit(id){await api("/habits/complete",{method:"POST",body:JSON.stringify({id})});openSection("goals")}