(function(){
 function num(v){return Number(v||0).toLocaleString("en-IN")}
 function pct(v){return Number(v||0).toFixed(1)+"%"}
 function money(v){return "$"+Number(v||0).toFixed(4)}
 function statusChip(stop){return '<span class="status-chip '+(stop?'danger':'success')+'">'+(stop?'STOP':'OK')+'</span>'}
 window.renderPilotOps=async function(root){
  const [m,people,feedback,review]=await Promise.all([api("/admin/pilot-metrics"),api("/admin/pilot-participants"),api("/admin/pilot-feedback"),api("/admin/pilot-review")]);
  root.innerHTML='<div class="top"><div><div class="eyebrow">Closed pilot</div><h1>Pilot Operations</h1><p class="label">Cohort health, activation, retention, AI latency, cost and stop conditions.</p></div><button class="ghost" id="refreshPilotOps">Refresh</button></div>'+
   '<div class="biz-alert '+(m.pilot_status==="CONTINUE"?"ok":"warn")+'"><b>'+esc(m.pilot_status)+'</b><span>'+(m.pilot_status==="CONTINUE"?"No automatic stop condition is currently triggered.":"Pause onboarding new users and review the triggered conditions.")+'</span></div>'+
   '<div class="biz-alert '+(review.current.recommendation==="PAUSE"?"warn":"ok")+'"><b>Expansion recommendation: '+esc(review.current.recommendation)+'</b><span>'+esc((review.current.reasons||[]).join(" "))+'</span></div>'+
   '<p><a href="/pilot-guide.html" target="_blank" rel="noopener">Open pilot tester guide ↗</a></p>'+
   '<div class="biz-grid">'+
    '<div class="biz-metric card"><span>Invited</span><b>'+num(m.activation.invited)+'</b><small>'+pct(m.activation.activation_rate_percent)+' activated</small></div>'+
    '<div class="biz-metric card"><span>First chat</span><b>'+num(m.activation.first_chat)+'</b><small>'+pct(m.activation.first_chat_rate_percent)+' of activated</small></div>'+
    '<div class="biz-metric card"><span>Onboarding complete</span><b>'+num(m.activation.onboarding_completed)+'</b><small>'+pct(m.activation.onboarding_completion_percent)+'</small></div>'+
    '<div class="biz-metric card"><span>D1 retention</span><b>'+pct(m.retention.d1_percent)+'</b><small>'+num(m.retention.returned_d1)+' returned</small></div>'+
    '<div class="biz-metric card"><span>D7 retention</span><b>'+pct(m.retention.d7_percent)+'</b><small>'+num(m.retention.returned_d7)+' returned</small></div>'+
    '<div class="biz-metric card"><span>AI cost / active user</span><b>'+money(m.usage.cost_per_active_user_usd)+'</b><small>Last 7 days</small></div>'+
   '</div>'+
   '<section class="card biz-section"><div class="section-head"><div><h2>Stop conditions</h2><span class="label">Any triggered condition means pause and review before expanding the cohort.</span></div></div>'+
    '<div class="list">'+m.stop_conditions.map(x=>'<div class="item"><div><b>'+esc(x.label)+'</b><div class="label">Current: '+num(x.value)+' · Threshold: '+num(x.threshold)+'</div></div>'+statusChip(x.stop)+'</div>').join("")+'</div></section>'+
   '<section class="card biz-section"><div class="section-head"><div><h2>AI latency · 7 days</h2></div></div>'+
    '<div class="biz-table-wrap"><table class="biz-table"><thead><tr><th>Provider</th><th>Runs</th><th>Average</th><th>P50</th><th>P95</th><th>Errors</th></tr></thead><tbody>'+
    (m.ai_latency.length?m.ai_latency.map(x=>'<tr><td>'+esc(x.provider)+'</td><td>'+num(x.runs)+'</td><td>'+num(x.avg_latency_ms)+' ms</td><td>'+num(x.p50_latency_ms)+' ms</td><td>'+num(x.p95_latency_ms)+' ms</td><td>'+num(x.errors)+'</td></tr>').join(""):'<tr><td colspan="6">No AI latency data yet.</td></tr>')+
    '</tbody></table></div></section>'+
   '<section class="card biz-section"><div class="section-head"><div><h2>Pilot participants</h2><span class="label">Invite by email after the user has signed in once.</span></div><button class="primary" id="invitePilotUser">+ Add participant</button></div>'+
    '<div class="biz-table-wrap"><table class="biz-table"><thead><tr><th>Email</th><th>Cohort</th><th>Status</th><th>Activated</th><th>Last seen</th></tr></thead><tbody>'+
    (people.length?people.map(x=>'<tr><td>'+esc(x.email||x.user_id)+'</td><td>'+esc(x.cohort)+'</td><td>'+esc(x.status)+'</td><td>'+esc(x.activated_at?new Date(x.activated_at).toLocaleString():"—")+'</td><td>'+esc(x.last_seen_at?new Date(x.last_seen_at).toLocaleString():"—")+'</td></tr>').join(""):'<tr><td colspan="5">No pilot participants yet.</td></tr>')+
    '</tbody></table></div></section>'+
   '<section class="card biz-section"><div class="section-head"><div><h2>Recent feedback</h2></div></div><div class="list">'+
    (feedback.length?feedback.slice(0,20).map(x=>'<div class="item"><div><b>'+esc(x.category)+' · '+esc(x.severity)+'</b><div class="label">'+esc(x.message)+'</div></div><span class="pill">'+esc(x.status)+'</span></div>').join(""):'<div class="empty">No feedback yet.</div>')+
   '</div></section>'+
   '<section class="card biz-section"><div class="section-head"><div><h2>Daily review history</h2><span class="label">Automatic snapshots support Day-1, Day-3 and Day-7 decisions.</span></div><button class="secondary" id="savePilotReview">Save review now</button></div>'+
    '<div class="biz-table-wrap"><table class="biz-table"><thead><tr><th>Date</th><th>Checkpoint</th><th>Recommendation</th><th>Reason</th></tr></thead><tbody>'+
    ((review.history||[]).length?review.history.map(x=>'<tr><td>'+esc(x.review_date)+'</td><td>'+esc(x.checkpoint)+'</td><td>'+esc(x.recommendation)+'</td><td>'+esc((x.reasons||[]).join(" "))+'</td></tr>').join(""):'<tr><td colspan="4">No review snapshot yet.</td></tr>')+
    '</tbody></table></div></section>';
  document.getElementById("refreshPilotOps").onclick=()=>renderPilotOps(root);
  document.getElementById("invitePilotUser").onclick=invitePilotUser;
  document.getElementById("savePilotReview").onclick=async()=>{await api("/admin/pilot-review",{method:"POST",body:JSON.stringify({checkpoint:"MANUAL"})});window.SecondBrainToast?.("Pilot review snapshot saved.");await renderPilotOps(root)};
  window.SecondBrainShell?.setContext("Pilot Operations");
 }
 async function invitePilotUser(){
  const email=(prompt("Pilot user email")||"").trim();if(!email)return;
  try{
   await api("/admin/pilot-participants",{method:"POST",body:JSON.stringify({email,status:"INVITED",cohort:"PILOT_1"})});
   window.SecondBrainToast?.("Pilot participant added.");
   await renderPilotOps(document.getElementById("content"));
  }catch(e){window.SecondBrainToast?.(e.message||"Unable to add participant.")}
 }
})();