function todayGreeting(){const h=new Date().getHours();return h<12?"Good morning":h<17?"Good afternoon":"Good evening"}
function fmtTime(v){if(!v)return"";try{return new Date(v).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}catch{return""}}
function fmtShort(v){if(!v)return"";try{return new Date(v).toLocaleString([],{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}catch{return""}}
function promptChat(text){sessionStorage.setItem("secondbrain.pendingPrompt",text);openSection("chat")}
function todayBrief(d){
 const bits=[];
 if(d.focus.length)bits.push(d.focus.length+" priority "+(d.focus.length===1?"task":"tasks")+" need attention");
 if(d.events.length)bits.push(d.events.length+" calendar "+(d.events.length===1?"event":"events")+" today");
 if(d.overdue.length)bits.push(d.overdue.length+" overdue");
 if(d.conflicts.length)bits.push("a schedule conflict");
 if(!bits.length)return"Your day looks clear. This is a good window for focused work or planning ahead.";
 return"Today you have "+bits.join(", ")+". "+(d.conflicts.length?"Resolve the calendar conflict first, then protect time for your highest-priority task.":"Start with the highest-priority item and keep the rest of the day flexible.");
}
async function renderBriefing(root){
 root.innerHTML='<div class="today-skeleton"><div class="skeleton" style="height:120px"></div><div class="today-grid"><div class="skeleton" style="height:260px"></div><div class="skeleton" style="height:260px"></div></div></div>';
 const d=await api("/briefing/today");
 const habits=d.habits||[],goals=d.goals||[],recent=d.recent_conversations||[];
 const doneHabits=habits.filter(h=>h.completed_today).length;
 const nextEvent=d.events.find(e=>new Date(e.start_at)>new Date())||d.events[0]||null;
 const suggestions=[
  ["Plan my day","Help me plan the rest of today using my current tasks, calendar and reminders."],
  [d.overdue.length?"Fix overdue":"Review priorities",d.overdue.length?"Help me clear my overdue tasks in the best order.":"Review my priorities and tell me what matters most today."],
  [d.events.length?"Prepare for next event":"Find focus time",d.events.length?"Help me prepare for my next calendar event.":"Find the best focus block for me today."],
  ["Continue project","Summarize what I was recently working on and suggest the best next step."]
 ];
 const focusHtml=d.focus.length?d.focus.map(t=>'<button class="today-task" data-open-section="tasks"><span class="task-check" aria-hidden="true"></span><span><b>'+esc(t.title)+'</b><small>'+(t.due_at?esc(fmtShort(t.due_at)):"Today")+'</small></span><span class="pill">'+esc(t.priority)+'</span></button>').join(""):'<div class="daily-empty">No priority tasks due today.</div>';
 const eventsHtml=d.events.length?d.events.slice(0,4).map(e=>'<div class="timeline-row"><div class="timeline-time">'+esc(e.all_day?"All day":fmtTime(e.start_at))+'</div><div class="timeline-marker"></div><div><b>'+esc(e.title)+'</b><small>'+esc(e.location||"Calendar")+'</small></div></div>').join(""):'<div class="daily-empty">No events scheduled today.</div>';
 const reminderHtml=d.reminders.length?d.reminders.slice(0,3).map(r=>'<div class="mini-row"><span>◷</span><div><b>'+esc(r.title)+'</b><small>'+esc(fmtTime(r.remind_at))+'</small></div></div>').join(""):'<div class="daily-empty compact">Nothing else to remember.</div>';
 const habitHtml=habits.length?habits.slice(0,5).map(h=>'<div class="habit-row"><div><b>'+esc(h.name)+'</b><small>'+(h.current_streak?esc(h.current_streak+" day streak"):"Build consistency")+'</small></div><span class="habit-state '+(h.completed_today?"done":"")+'">'+(h.completed_today?"✓":"○")+'</span></div>').join(""):'<div class="daily-empty compact">Add a habit to start tracking gentle progress.</div>';
 const goalHtml=goals.length?goals.slice(0,3).map(g=>'<div class="goal-row"><div class="section-head compact"><b>'+esc(g.title)+'</b><span class="label">'+esc(g.progress_percent)+"%</span></div><div class=\"progress\"><span style=\"width:"+Math.max(0,Math.min(100,g.progress_percent))+"%\"></span></div></div>").join(""):'<div class="daily-empty compact">No active goals yet.</div>';
 const recentHtml=recent.length?recent.slice(0,3).map(c=>'<button class="continue-card" data-open-section="chat"><span class="continue-icon">✦</span><span><b>'+esc(c.title||"Conversation")+'</b><small>Updated '+esc(fmtShort(c.updated_at))+'</small></span><span>→</span></button>').join(""):'<div class="daily-empty compact">Your recent work will appear here.</div>';
 const promptHtml=suggestions.map((s,i)=>'<button class="chip action today-prompt" data-prompt-index="'+i+'">'+esc(s[0])+'</button>').join("");
 root.innerHTML=
 '<section class="today-hero"><div><div class="eyebrow">'+esc(new Date().toLocaleDateString([],{weekday:"long",month:"long",day:"numeric"}))+'</div><h1>'+esc(todayGreeting())+'</h1><p>'+esc(todayBrief(d))+'</p><div class="prompt-chips">'+promptHtml+'</div></div><div class="daily-score"><span>Today</span><b>'+esc(d.completed_today+doneHabits)+'</b><small>completed signals</small></div></section>'+
 '<section class="today-stats"><button data-open-section="tasks"><span>Priorities</span><b>'+d.focus.length+'</b><small>'+d.overdue.length+' overdue</small></button><button data-open-section="calendar"><span>Next event</span><b class="stat-text">'+esc(nextEvent?(nextEvent.all_day?"All day":fmtTime(nextEvent.start_at)):"Open")+'</b><small>'+esc(nextEvent?nextEvent.title:"No events")+'</small></button><button data-open-section="reminders"><span>Reminders</span><b>'+d.reminders.length+'</b><small>scheduled today</small></button><button data-open-section="goals"><span>Habits</span><b>'+doneHabits+'/'+habits.length+'</b><small>completed today</small></button></section>'+
 '<div class="today-grid"><section class="card today-panel"><div class="section-head"><div><div class="eyebrow">Focus</div><h2>What matters now</h2></div><button class="ghost" data-open-section="tasks">All tasks</button></div><div class="today-task-list">'+focusHtml+'</div></section>'+
 '<section class="card today-panel"><div class="section-head"><div><div class="eyebrow">Schedule</div><h2>Your day</h2></div><button class="ghost" data-open-section="calendar">Calendar</button></div><div class="timeline">'+eventsHtml+'</div><div class="today-subsection"><h3>Reminders</h3>'+reminderHtml+'</div></section></div>'+
 '<div class="today-grid lower"><section class="card today-panel"><div class="section-head"><div><div class="eyebrow">Momentum</div><h2>Habits & goals</h2></div></div><div class="habit-list">'+habitHtml+'</div><div class="today-subsection"><h3>Active goals</h3>'+goalHtml+'</div></section>'+
 '<section class="card today-panel ai-brief-card"><div class="assistant-orb" aria-hidden="true"><span></span></div><div><div class="eyebrow">SecondBrain brief</div><h2>One useful read on today</h2><p>'+esc(todayBrief(d))+'</p>'+(d.conflicts.length?'<div class="attention-note">⚠ '+esc(d.conflicts[0].first)+' overlaps with '+esc(d.conflicts[0].second)+'.</div>':'')+'<button class="secondary" id="deeperToday">Explore with AI</button></div></section></div>'+
 '<section class="section"><div class="section-head"><div><div class="eyebrow">Pick up the thread</div><h2>Continue where you left off</h2></div></div><div class="continue-grid">'+recentHtml+'</div></section>';
 root.querySelectorAll("[data-open-section]").forEach(el=>el.addEventListener("click",()=>openSection(el.dataset.openSection)));
 root.querySelectorAll(".today-prompt").forEach(el=>el.addEventListener("click",()=>promptChat(suggestions[Number(el.dataset.promptIndex)][1])));
 document.getElementById("deeperToday")?.addEventListener("click",()=>promptChat("Give me a deeper analysis of my day and recommend the best sequence of actions."));
 window.SecondBrainShell?.setContext("Today");
}