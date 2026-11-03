(()=>{
const groups=[
 {label:"Home",items:[['briefing','Today','☀'],['chat','Chat','✦'],['guide','Guide & Help','?']]},
 {label:"Workspace",items:[['tasks','Tasks','✓'],['calendar','Calendar','▦'],['notes','Notes','▤'],['documents','Documents','▧'],['goals','Goals','◎'],['organizations','Organizations','◫']]},
 {label:"Knowledge",items:[['search','Search','⌕'],['memory','Memory','◇']]},
 {label:"Automations",items:[['reminders','Reminders','◷'],['notifications','Notifications','◉']]},
 {label:"Review",items:[['focus','Focus','◌'],['stats','Productivity','↗'],['insights','Insights','✧'],['review','Weekly review','□']]},
 {label:"System",items:[['integrations','Integrations','⌘'],['approvals','Approvals','✓'],['plans','Plans & Billing','₹'],['platform','Developer & Platform','⌘'],['settings','Settings','⚙']]}
];
const commands=[
 ['Go to Today','briefing','Open your daily workspace'],['Ask AI','chat','Start or continue a conversation'],['Open Guide & Help','guide','Learn every section and feature'],['Open tasks','tasks','Review tasks and priorities'],['Open calendar','calendar','See upcoming events'],['Search everything','search','Search workspace, documents and memory'],['Open memory','memory','Review what your assistant remembers'],['Open documents','documents','Browse uploaded knowledge'],['Open organizations','organizations','Manage team workspaces and seats'],['Open integrations','integrations','Manage Google and GitHub'],['Review approvals','approvals','Review sensitive actions'],['Plans and billing','plans','Compare plans and manage subscription'],['Developer and platform','platform','API keys, marketplace and white-label'],['Open settings','settings','Theme, style and preferences']
];
function navHTML(){return groups.map(g=>`<div class="nav-group"><div class="nav-label">${g.label}</div>${g.items.map(([id,label,icon,adminOnly])=>`<button class="nav-item" data-section="${id}" aria-label="${label}" ${adminOnly?'data-admin-only="true" hidden':''}><span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span>${id==='approvals'?'<span class="nav-badge" id="approvalBadge" hidden>0</span>':''}</button>`).join('')}</div>`).join('')}
function paletteHTML(){return `<div class="command-backdrop" id="commandBackdrop" hidden><div class="command-palette" role="dialog" aria-modal="true" aria-labelledby="commandTitle"><div class="command-input-wrap"><span aria-hidden="true">⌕</span><input id="commandInput" autocomplete="off" placeholder="Search or run a command…" aria-label="Search commands"><kbd>Esc</kbd></div><div id="commandResults" class="command-results"></div><div class="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>Enter</kbd> open</span></div></div></div>`}
function mobileHTML(){return `<div class="mobile-topbar"><button class="icon-btn" id="mobileMenuBtn" aria-label="Open navigation">☰</button><div class="mobile-brand">second<span>brain</span></div><button class="icon-btn" id="mobileCommandBtn" aria-label="Open command palette">⌕</button></div><div class="mobile-overlay" id="mobileOverlay" hidden></div>`}
function contextHTML(){return `<div class="app-topbar"><div class="context-bar" id="contextBar" aria-label="Current assistant context"><span class="context-dot" aria-hidden="true"></span><span id="contextSection">Personal Assistant</span><span class="context-sep">·</span><span id="connectionContext">Private workspace</span></div><div class="topbar-actions"><button class="command-trigger" id="commandTrigger" aria-label="Open command palette"><span>⌕ Search or run a command</span><kbd>⌘ K</kbd></button><button class="icon-btn" id="themeCycle" aria-label="Change theme">◐</button></div></div>`}
function mount(){const shell=document.querySelector('.shell');const sidebar=document.querySelector('.sidebar');const main=document.querySelector('.main');if(!shell||!sidebar||!main)return;
 sidebar.innerHTML=`<div class="brand-row"><div class="assistant-mark" aria-hidden="true"><span></span></div><div class="brand">second<span>brain</span><small>personal intelligence</small></div></div><nav class="nav" aria-label="Primary navigation">${navHTML()}</nav><div class="sidebar-footer"><button class="nav-item" id="signOutBtn"><span class="nav-icon">↗</span><span>Sign out</span></button></div>`;
 main.insertAdjacentHTML('afterbegin',contextHTML());document.body.insertAdjacentHTML('afterbegin',mobileHTML());document.body.insertAdjacentHTML('beforeend',paletteHTML());
 bind();refreshApprovals();refreshConnections();setTimeout(()=>window.openSection?.('briefing'),0);
}
function bind(){document.querySelectorAll('.nav-item[data-section]').forEach(b=>b.addEventListener('click',()=>{window.openSection?.(b.dataset.section);closeMobile()}));
 document.getElementById('commandTrigger')?.addEventListener('click',openPalette);document.getElementById('mobileCommandBtn')?.addEventListener('click',openPalette);
 document.getElementById('mobileMenuBtn')?.addEventListener('click',openMobile);document.getElementById('mobileOverlay')?.addEventListener('click',closeMobile);
 document.getElementById('themeCycle')?.addEventListener('click',()=>{const cur=document.documentElement.dataset.theme||'system';const next=cur==='system'?'dark':cur==='dark'?'light':'system';window.SecondBrainDesign?.setTheme?.(next)});
 document.getElementById('signOutBtn')?.addEventListener('click',signOut);
 document.getElementById('commandBackdrop')?.addEventListener('mousedown',e=>{if(e.target.id==='commandBackdrop')closePalette()});
 const input=document.getElementById('commandInput');input?.addEventListener('input',renderCommands);input?.addEventListener('keydown',paletteKeys);
 document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPalette()}else if(e.key==='Escape'){closePalette();closeMobile()}});
}
function renderCommands(){const q=(document.getElementById('commandInput')?.value||'').toLowerCase().trim();const list=commands.filter(c=>!q||c.join(' ').toLowerCase().includes(q));const root=document.getElementById('commandResults');if(!root)return;root.innerHTML=list.length?list.map((c,i)=>`<button class="command-item${i===0?' selected':''}" data-command="${c[1]}"><span><b>${c[0]}</b><small>${c[2]}</small></span><span aria-hidden="true">↵</span></button>`).join(''):`<div class="command-empty">No matching command</div>`;root.querySelectorAll('.command-item').forEach(b=>b.onclick=()=>runCommand(b.dataset.command))}
function paletteKeys(e){const items=[...document.querySelectorAll('.command-item')];if(!items.length)return;let i=Math.max(0,items.findIndex(x=>x.classList.contains('selected')));if(e.key==='ArrowDown'){e.preventDefault();items[i].classList.remove('selected');items[(i+1)%items.length].classList.add('selected')}else if(e.key==='ArrowUp'){e.preventDefault();items[i].classList.remove('selected');items[(i-1+items.length)%items.length].classList.add('selected')}else if(e.key==='Enter'){e.preventDefault();runCommand(items[i].dataset.command)}}
function runCommand(section){closePalette();window.openSection?.(section)}
function openPalette(){const b=document.getElementById('commandBackdrop');if(!b)return;b.hidden=false;requestAnimationFrame(()=>b.classList.add('open'));const i=document.getElementById('commandInput');if(i){i.value='';renderCommands();setTimeout(()=>i.focus(),0)}}
function closePalette(){const b=document.getElementById('commandBackdrop');if(!b||b.hidden)return;b.classList.remove('open');setTimeout(()=>{b.hidden=true},120)}
async function signOut(){try{await window.hatchable?.auth?.signOut?.()}catch{}location.replace('/login')}
function openMobile(){document.querySelector('.sidebar')?.classList.add('mobile-open');const o=document.getElementById('mobileOverlay');if(o)o.hidden=false}
function closeMobile(){document.querySelector('.sidebar')?.classList.remove('mobile-open');const o=document.getElementById('mobileOverlay');if(o)o.hidden=true}
async function refreshApprovals(){try{const r=await fetch('/api/tools/approvals');if(!r.ok)return;const rows=await r.json();const n=Array.isArray(rows)?rows.filter(x=>x.status==='PENDING'&&(!x.expires_at||new Date(x.expires_at).getTime()>Date.now())).length:0;const b=document.getElementById('approvalBadge');if(b){b.textContent=n;b.hidden=!n}}catch{}}
async function refreshAdminAccess(){try{const r=await fetch("/api/business/overview");if(!r.ok)return;document.querySelectorAll("[data-admin-only=\"true\"]").forEach(el=>el.hidden=false)}catch{}}
async function refreshConnections(){try{const [g,h]=await Promise.all([fetch('/api/google/status'),fetch('/api/github/status')]);const names=[];if(g.ok){const x=await g.json();if(x.connected)names.push('Google')}if(h.ok){const x=await h.json();if(x.connected)names.push('GitHub')}const el=document.getElementById('connectionContext');if(el)el.textContent=names.length?names.join(' + ')+' connected':'Private workspace'}catch{}}
window.SecondBrainShell={mount,refreshApprovals,refreshConnections,setContext(label){const el=document.getElementById('contextSection');if(el)el.textContent=label}};
async function boot(){
 try{
  const A=window.hatchable&&window.hatchable.auth;
  if(!A||!A.getSession){location.replace('/welcome.html?next='+encodeURIComponent(location.pathname+location.search));return}
  const session=await A.getSession();
  if(!session||!session.user){location.replace('/welcome.html?next='+encodeURIComponent(location.pathname+location.search));return}
  window.SecondBrainUser=session.user;
  const pilot=await fetch('/api/pilot/status',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  if(!pilot.ok){
   document.body.innerHTML='<main style="max-width:680px;margin:80px auto;padding:24px;font-family:system-ui"><h1>Closed pilot</h1><p>This build is currently invite-only. Your signed-in account has not been added to the pilot yet.</p><p>If you were invited, contact the pilot administrator and share the email address you used to sign in.</p><button onclick="location.href=\'/login\'">Return to sign in</button></main>';
   return;
  }
  const pilotState=await pilot.json().catch(()=>null);
  window.SecondBrainPilotState=pilotState;
  mount();
  setTimeout(()=>window.SecondBrainPilot?.refresh?.(),250);
 }catch{
  location.replace('/welcome.html?next='+encodeURIComponent(location.pathname+location.search));
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();