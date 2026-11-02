(function(){
const groups=[
 {title:"Start here",items:[
  {id:"today",icon:"☀",name:"Today",summary:"See your day in one place.",detail:"Combines nearby tasks, reminders and calendar activity into a daily workspace so you can quickly see what needs attention.",tips:["Open this first thing in the morning.","Use it to identify overdue or time-sensitive work.","Jump to Chat when you want help planning the day."]},
  {id:"chat",icon:"✦",name:"AI Chat",summary:"Ask, plan, write and act with context.",detail:"Your main conversation space. Use it for questions, drafting, planning, summarization and workspace-aware assistance. When tools are needed, SecondBrain can use approved integrations and your saved context.",tips:["Ask naturally instead of learning commands.","Reference tasks, goals, notes or documents when useful.","Sensitive actions still require approval."]}
 ]},
 {title:"Workspace",items:[
  {id:"tasks",icon:"✓",name:"Tasks",summary:"Capture work and keep priorities visible.",detail:"Create and review tasks with priority, status and due dates. Tasks feed into Today, Focus and productivity views.",tips:["Add a clear action verb to task titles.","Use due dates only when they are real deadlines.","Review overdue tasks in Today."]},
  {id:"calendar",icon:"▦",name:"Calendar",summary:"See scheduled events alongside your work.",detail:"Review calendar events and connected Google Calendar information so time commitments can inform your daily plan.",tips:["Connect Google for live calendar context.","Use Today to see events together with tasks.","Approved calendar creation is available through connected tools."]},
  {id:"notes",icon:"▤",name:"Notes",summary:"Keep lightweight information close to your workflow.",detail:"Store quick notes, ideas and reference material you want inside your personal workspace without creating a document.",tips:["Use Notes for short reusable information.","Use Documents for larger files.","Search can help you find notes later."]},
  {id:"documents",icon:"▧",name:"Documents",summary:"Upload files and ask questions about them.",detail:"Upload supported PDFs and text-based files. SecondBrain extracts and indexes the content so you can ask document-grounded questions later.",tips:["Use clear filenames.","Upload non-sensitive material during the pilot.","Ask focused questions for better answers."]},
  {id:"goals",icon:"◎",name:"Goals",summary:"Track outcomes, not just individual tasks.",detail:"Create longer-term goals and monitor progress. Goals help connect everyday tasks to bigger outcomes and can be used in reviews and planning.",tips:["Write goals as measurable outcomes.","Set a realistic target date.","Break each goal into actionable tasks."]},
  {id:"organizations",icon:"◫",name:"Organizations",summary:"Collaborate in shared team workspaces.",detail:"Create or join organizations, invite teammates, assign roles, share notes/tasks/decisions/links, and review organization activity.",tips:["Use personal workspace for private information.","Use organization items only for intentionally shared work.","Admins can manage invitations and roles."]}
 ]},
 {title:"Knowledge",items:[
  {id:"search",icon:"⌕",name:"Search",summary:"Find information across your workspace.",detail:"Search across workspace content so you do not need to remember whether something was stored in a note, memory, conversation or document.",tips:["Search by topic, project or phrase.","Use specific keywords for faster results.","Open the source item after finding it."]},
  {id:"memory",icon:"◇",name:"Memory",summary:"Control what your assistant remembers.",detail:"Save preferences, project context, goals and personal facts that can make future conversations more useful. Every memory is reviewable and removable.",tips:["Save durable context, not temporary details.","Set higher importance for context you use often.","Review and forget outdated memories."]}
 ]},
 {title:"Automations",items:[
  {id:"reminders",icon:"◷",name:"Reminders",summary:"Get nudged at the right time.",detail:"Schedule reminders for future actions or deadlines. Reminder jobs run automatically and surface notifications when due.",tips:["Use a clear reminder title.","Include an exact date/time.","Use Tasks when the work also needs status tracking."]},
  {id:"notifications",icon:"◉",name:"Notifications",summary:"See briefings, reminders and important updates.",detail:"Central place for system-generated updates such as reminders, daily briefings and weekly review notifications.",tips:["Check unread items regularly.","Use notifications as prompts, not storage.","Open the related section when action is needed."]}
 ]},
 {title:"Review & intelligence",items:[
  {id:"focus",icon:"◌",name:"Focus",summary:"Turn your workload into a practical focus plan.",detail:"Helps prioritize what deserves attention using your tasks, due dates and current workload so you can focus on the highest-value next actions.",tips:["Use when your task list feels overwhelming.","Re-check after finishing major work.","Keep task priorities accurate."]},
  {id:"stats",icon:"↗",name:"Productivity",summary:"See how your work is moving.",detail:"Shows productivity metrics such as tasks created, completed, overdue, notes, events and reminder activity over time.",tips:["Look for trends instead of one-day fluctuations.","Use overdue counts as a workflow health signal.","Pair metrics with Weekly Review."]},
  {id:"insights",icon:"✧",name:"AI Insights",summary:"Turn activity data into useful observations.",detail:"Uses your workspace activity to surface patterns and practical observations that may help improve planning and execution.",tips:["Treat insights as suggestions, not facts.","Compare them with your own experience.","Use them to adjust workflows gradually."]},
  {id:"review",icon:"□",name:"Weekly Review",summary:"Reflect on progress and reset for the next week.",detail:"Summarizes recent productivity and progress so you can see what was completed, what slipped and where to focus next.",tips:["Review at the same time each week.","Resolve stale overdue tasks.","Turn important review findings into new tasks or goals."]}
 ]},
 {title:"Connections & control",items:[
  {id:"integrations",icon:"⌘",name:"Integrations",summary:"Connect Google Workspace and GitHub.",detail:"Connect Gmail, Calendar, Drive and GitHub so SecondBrain can read relevant information when you ask and prepare approved actions.",tips:["Connect only services you need.","Review permissions before connecting.","Disconnect any integration from this section at any time."]},
  {id:"approvals",icon:"✓",name:"Approvals",summary:"Review sensitive actions before they run.",detail:"Actions such as sending email, creating calendar events or writing to GitHub can wait here for explicit confirmation before execution.",tips:["Check the action details carefully.","Reject anything unexpected.","Higher plans never bypass approvals."]},
  {id:"plans",icon:"₹",name:"Plans & Billing",summary:"See usage, limits and subscription options.",detail:"Review your current plan, usage allowance, feature access, provisional Plus/Pro options, add-ons and subscription status.",tips:["Check remaining units before upgrading.","Your data remains when plans change.","Billing will be fully enabled after pilot validation."]},
  {id:"platform",icon:"⌘",name:"Developer & Platform",summary:"Use API and platform capabilities as you grow.",detail:"Provides foundations for scoped developer API keys, integration marketplace, organization branding and partner attribution. Some features require higher plans.",tips:["Revoke unused API keys.","Keep API secrets private.","Use scoped keys with the minimum permissions needed."]},
  {id:"settings",icon:"⚙",name:"Settings",summary:"Control preferences, privacy and account lifecycle.",detail:"Manage assistant preferences, theme, response style, integrations, data export, privacy requests, pilot feedback and account deletion controls.",tips:["Review privacy options before adding sensitive information.","Export your data when needed.","Use pilot feedback to report bugs or usability issues."]}
 ]},
 {title:"Admin-only",items:[
  {id:"pilotops",icon:"◫",name:"Pilot Operations",summary:"Operate the closed pilot safely.",detail:"Admin dashboard for participant management, activation, retention, AI latency, cost, feedback and automatic stop conditions.",tips:["Add users only after they sign in once.","Do not expand the cohort when a stop condition triggers.","Review Day-1, Day-3 and Day-7 signals."]},
  {id:"business",icon:"↗",name:"Business Analytics",summary:"Understand product economics and business performance.",detail:"Admin-only view of usage, plans, cost, revenue and commercial metrics used to validate pricing and sustainability.",tips:["Use real pilot data before changing pricing.","Watch cost per active user.","Separate test data from real customer metrics."]}
 ]}
];

function allItems(){return groups.flatMap(g=>g.items.map(x=>({...x,group:g.title})))}
function card(item){
 return '<article class="guide-card" data-guide="'+item.id+'"><div class="guide-card-head"><span class="guide-icon">'+item.icon+'</span><div><span class="guide-group">'+esc(item.group||"")+'</span><h3>'+esc(item.name)+'</h3></div></div><p class="guide-summary">'+esc(item.summary)+'</p><p class="guide-detail">'+esc(item.detail)+'</p><div class="guide-tips">'+item.tips.map(t=>'<span>• '+esc(t)+'</span>').join("")+'</div><button class="secondary guide-open" data-open-guide="'+item.id+'">Open '+esc(item.name)+'</button></article>'
}

window.renderGuide=function(root){
 const items=allItems();
 root.innerHTML='<div class="top guide-top"><div><div class="eyebrow">Help & product guide</div><h1>Learn SecondBrain</h1><p class="label">Understand every section, what it is for, and the fastest way to get value from it.</p></div><button class="primary" id="guideStart">Start with Today</button></div>'+
 '<section class="guide-start card"><div><div class="eyebrow">Recommended first session</div><h2>Five minutes to get set up</h2></div><ol><li><b>Ask one real question</b><span>Open Chat and use SecondBrain for something useful immediately.</span></li><li><b>Create one task</b><span>Give the assistant an action it can help you track.</span></li><li><b>Save one memory</b><span>Add a preference, goal or project fact you want reused later.</span></li><li><b>Try a document</b><span>Upload a small non-sensitive file and ask a focused question.</span></li><li><b>Connect tools when useful</b><span>Google and GitHub are optional; connect only what improves your workflow.</span></li></ol></section>'+
 '<div class="guide-toolbar"><input id="guideSearch" placeholder="Search features, e.g. documents, memory, approvals…"><div class="guide-chips">'+groups.map((g,i)=>'<button class="chip action" data-guide-group="'+i+'">'+esc(g.title)+'</button>').join("")+'</div></div>'+
 '<div id="guideSections">'+groups.map((g,i)=>'<section class="guide-section" data-guide-section="'+i+'"><div class="guide-section-head"><div><span class="eyebrow">'+esc(g.title)+'</span><h2>'+esc(g.title)+'</h2></div><span class="label">'+g.items.length+' '+(g.items.length===1?"section":"sections")+'</span></div><div class="guide-grid">'+g.items.map(x=>card({...x,group:g.title})).join("")+'</div></section>').join("")+'</div>'+
 '<section class="guide-help card"><div><div class="eyebrow">Need help?</div><h2>Three things to remember</h2></div><div class="guide-help-grid"><div><b>Ask naturally</b><span>You do not need special commands. Describe what you want in normal language.</span></div><div><b>Keep control</b><span>Review Memory, Integrations and Approvals whenever you want to see what the assistant can use or do.</span></div><div><b>Report problems</b><span>During the pilot, go to Settings → Send pilot feedback for bugs, performance problems or feature ideas.</span></div></div></section>';
 bindGuide(root,items);
 window.SecondBrainShell?.setContext("Guide & Help");
};

function bindGuide(root,items){
 document.getElementById("guideStart").onclick=()=>window.openSection?.("briefing");
 root.querySelectorAll("[data-open-guide]").forEach(b=>b.onclick=()=>window.openSection?.(b.dataset.openGuide));
 root.querySelectorAll("[data-guide-group]").forEach(b=>b.onclick=()=>document.querySelector('[data-guide-section="'+b.dataset.guideGroup+'"]')?.scrollIntoView({behavior:"smooth",block:"start"}));
 const input=document.getElementById("guideSearch");
 input.addEventListener("input",()=>{
   const q=input.value.trim().toLowerCase();
   root.querySelectorAll(".guide-card").forEach(c=>{
     const item=items.find(x=>x.id===c.dataset.guide);
     c.hidden=!!q&&!([item.name,item.summary,item.detail,item.group,...item.tips].join(" ").toLowerCase().includes(q));
   });
   root.querySelectorAll(".guide-section").forEach(s=>{s.hidden=!s.querySelector(".guide-card:not([hidden])")});
 });
}
})();