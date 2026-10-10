(function(){
 let orgState={list:[],active:null,detail:null,items:[],invites:[],audit:[]};
 function roleRank(r){return({MEMBER:1,BILLING:2,ADMIN:3,OWNER:4}[r]||0)}
 function shortId(v){const s=String(v||"");return s.length>14?s.slice(0,7)+"…"+s.slice(-5):s}
 function orgCard(o){return '<button class="org-switch '+(orgState.active===o.id?"active":"")+'" data-org="'+o.id+'"><span><b>'+esc(o.name)+'</b><small>'+esc(o.role)+' · '+o.active_seats+'/'+o.seat_limit+' seats</small></span><span>›</span></button>'}
 function itemCard(i){
  return '<article class="team-item"><div class="team-item-head"><span class="pill">'+esc(i.item_type)+'</span><span class="status-chip '+(i.status==="DONE"?"success":"neutral")+'">'+esc(i.status)+'</span></div><h3>'+esc(i.title)+'</h3><p>'+esc(i.content||"")+'</p><button class="ghost" data-edit-item="'+i.id+'">Edit</button></article>';
 }
 function memberRow(m,canAdmin,isOwner){
  const controls=isOwner&&m.role!=="OWNER"?'<select data-role-user="'+esc(m.user_id)+'"><option '+(m.role==="MEMBER"?"selected":"")+'>MEMBER</option><option '+(m.role==="BILLING"?"selected":"")+'>BILLING</option><option '+(m.role==="ADMIN"?"selected":"")+'>ADMIN</option></select>':canAdmin&&m.role!=="OWNER"&&m.role!=="ADMIN"?'<button class="ghost danger-text" data-remove-user="'+esc(m.user_id)+'">Remove</button>':"";
  return '<div class="org-member"><div><b>'+esc(m.role)+'</b><small>'+esc(shortId(m.user_id))+' · '+esc(m.status)+'</small></div>'+controls+'</div>';
 }

 window.renderOrganizations=async function(root){
  orgState.list=await api("/organizations/list")||[];
  if(!orgState.active&&orgState.list.length)orgState.active=orgState.list[0].id;
  if(orgState.active&&!orgState.list.some(o=>o.id===orgState.active))orgState.active=orgState.list[0]?.id||null;
  if(orgState.active)await loadActive();
  const d=orgState.detail,role=d?.membership?.role,canAdmin=roleRank(role)>=3,isOwner=role==="OWNER";
  root.innerHTML='<div class="top"><div><div class="eyebrow">Business workspace</div><h1>Organizations</h1><p class="label">Shared workspace, seats and team administration.</p></div><div class="team-top-actions"><button class="ghost" id="joinOrg">Join with invite</button><button class="primary" id="createOrg">+ New organization</button></div></div>'+
   '<div class="org-layout"><aside class="card org-list"><div class="section-head"><h2>Your teams</h2></div>'+(orgState.list.length?orgState.list.map(orgCard).join(""):'<div class="daily-empty compact">No organizations yet.</div>')+'</aside>'+
   '<main class="org-main">'+(d?renderOrgMain(d,canAdmin,isOwner):'<div class="empty-state"><div class="empty-icon">◎</div><h3>Create your first team workspace</h3><p class="label">Organizations keep shared work separate from your personal SecondBrain.</p></div>')+'</main></div>';
  root.querySelectorAll("[data-org]").forEach(b=>b.onclick=async()=>{orgState.active=b.dataset.org;await renderOrganizations(root)});
  document.getElementById("createOrg").onclick=createOrganization;
  document.getElementById("joinOrg").onclick=joinOrganization;
  document.getElementById("newTeamItem")?.addEventListener("click",createItem);
  document.getElementById("inviteMember")?.addEventListener("click",createInvite);
  document.getElementById("renameOrg")?.addEventListener("click",renameOrganization);
  root.querySelectorAll("[data-edit-item]").forEach(b=>b.onclick=()=>editItem(b.dataset.editItem));
  root.querySelectorAll("[data-role-user]").forEach(s=>s.onchange=()=>changeRole(s.dataset.roleUser,s.value));
  root.querySelectorAll("[data-remove-user]").forEach(b=>b.onclick=()=>removeMember(b.dataset.removeUser));
  root.querySelectorAll("[data-revoke-invite]").forEach(b=>b.onclick=()=>revokeInvite(b.dataset.revokeInvite));
  window.SecondBrainShell?.setContext("Organizations");
 }

 function renderOrgMain(d,canAdmin,isOwner){
  const o=d.organization;
  return '<section class="team-hero card"><div><span class="eyebrow">'+esc(o.business_tier.replaceAll("_"," "))+'</span><h2>'+esc(o.name)+'</h2><p class="label">'+esc(d.membership.role)+' · '+d.members.filter(x=>x.status==="ACTIVE").length+'/'+o.seat_limit+' seats · Billing '+esc(o.billing_status)+'</p></div>'+(canAdmin?'<button class="ghost" id="renameOrg">Rename</button>':'')+'</section>'+
   '<div class="team-tabs-grid"><section class="card team-workspace"><div class="section-head"><div><h2>Shared workspace</h2><span class="label">Notes, tasks, links and decisions visible to the team.</span></div><button class="primary" id="newTeamItem">+ Add item</button></div><div class="team-items">'+(orgState.items.length?orgState.items.map(itemCard).join(""):'<div class="daily-empty">Nothing shared yet.</div>')+'</div></section>'+
   '<section class="card team-members"><div class="section-head"><div><h2>People</h2><span class="label">'+d.members.filter(x=>x.status==="ACTIVE").length+' active seats</span></div>'+(canAdmin?'<button class="secondary" id="inviteMember">Invite</button>':'')+'</div>'+d.members.filter(x=>x.status==="ACTIVE").map(m=>memberRow(m,canAdmin,isOwner)).join("")+
   (canAdmin?'<div class="pending-invites"><h3>Invites</h3>'+(orgState.invites.filter(x=>!x.accepted_at&&!x.revoked_at&&new Date(x.expires_at)>new Date()).map(i=>'<div class="invite-row"><span>'+esc(i.email_hint||"Invite")+' · '+esc(i.role)+'</span><button class="ghost" data-revoke-invite="'+i.id+'">Revoke</button></div>').join("")||'<span class="label">No pending invites.</span>')+'</div>':'')+'</section></div>'+
   (canAdmin?'<section class="card org-audit"><div class="section-head"><div><h2>Audit log</h2><span class="label">Recent organization administration and collaboration activity.</span></div></div><div class="audit-list">'+(orgState.audit.slice(0,30).map(a=>'<div class="audit-row"><div><b>'+esc(a.action.replaceAll("_"," "))+'</b><small>'+esc(a.actor_ref||'team member')+'</small></div><time>'+new Date(a.created_at).toLocaleString()+'</time></div>').join("")||'<div class="daily-empty compact">No activity yet.</div>')+'</div></section>':'');
 }

 async function loadActive(){
  const id=orgState.active;
  orgState.detail=await api("/organizations/detail?id="+encodeURIComponent(id));
  orgState.items=await api("/organizations/items?organization_id="+encodeURIComponent(id))||[];
  if(roleRank(orgState.detail.membership.role)>=3){
   [orgState.invites,orgState.audit]=await Promise.all([api("/organizations/invites?organization_id="+encodeURIComponent(id)),api("/organizations/audit?organization_id="+encodeURIComponent(id))]);
  }else{orgState.invites=[];orgState.audit=[]}
 }
 async function createOrganization(){
  const v=await window.SecondBrainDialog({title:"New organization",eyebrow:"Business",submit:"Create organization",fields:[{name:"name",label:"Organization name",required:true,placeholder:"Your company or team"}]});if(!v)return;
  const r=await api("/organizations/create",{method:"POST",body:JSON.stringify(v)});orgState.active=r.organization.id;await renderOrganizations(document.getElementById("content"));
 }
 async function joinOrganization(){
  const v=await window.SecondBrainDialog({title:"Join organization",eyebrow:"Invitation",submit:"Join",fields:[{name:"invite_token",label:"Invite token",required:true,placeholder:"Paste the invite token"}]});if(!v)return;
  const r=await api("/organizations/accept-invite",{method:"POST",body:JSON.stringify(v)});orgState.active=r.organization.id;window.SecondBrainToast?.("Joined "+r.organization.name);await renderOrganizations(document.getElementById("content"));
 }
 async function createInvite(){
  const d=orgState.detail,o=d.organization;
  const v=await window.SecondBrainDialog({title:"Invite teammate",eyebrow:"Seats",submit:"Create invite",fields:[{name:"email_hint",label:"Email label",type:"email",placeholder:"teammate@company.com"},{name:"role",label:"Role",type:"select",value:"MEMBER",options:[{value:"MEMBER",label:"Member"},{value:"ADMIN",label:"Admin"},{value:"BILLING",label:"Billing"}]}]});if(!v)return;
  const r=await api("/organizations/invite",{method:"POST",body:JSON.stringify({organization_id:o.id,...v})});
  await navigator.clipboard?.writeText(r.invite_token).catch(()=>{});
  await window.SecondBrainDialog({title:"Invite created",eyebrow:"Copy securely",submit:"Close",html:'<p>Share this one-time invite token with the teammate. It expires on '+esc(new Date(r.expires_at).toLocaleString())+'.</p><pre class="approval-input">'+esc(r.invite_token)+'</pre><p class="label">The token was also copied to your clipboard when browser permission allowed it.</p>'});
  await renderOrganizations(document.getElementById("content"));
 }
 async function createItem(){
  const v=await window.SecondBrainDialog({title:"Share with team",eyebrow:"Workspace",submit:"Add item",fields:[{name:"item_type",label:"Type",type:"select",value:"NOTE",options:[{value:"NOTE",label:"Note"},{value:"TASK",label:"Task"},{value:"DECISION",label:"Decision"},{value:"LINK",label:"Link"}]},{name:"title",label:"Title",required:true},{name:"content",label:"Content",type:"textarea",rows:5}]});if(!v)return;
  await api("/organizations/create-item",{method:"POST",body:JSON.stringify({organization_id:orgState.active,...v})});await renderOrganizations(document.getElementById("content"));
 }
 async function editItem(id){
  const item=orgState.items.find(x=>x.id===id);if(!item)return;
  const v=await window.SecondBrainDialog({title:"Edit shared item",eyebrow:item.item_type,submit:"Save",fields:[{name:"title",label:"Title",required:true,value:item.title},{name:"content",label:"Content",type:"textarea",rows:5,value:item.content},{name:"status",label:"Status",type:"select",value:item.status,options:[{value:"ACTIVE",label:"Active"},{value:"DONE",label:"Done"},{value:"ARCHIVED",label:"Archived"}]}]});if(!v)return;
  await api("/organizations/update-item",{method:"POST",body:JSON.stringify({organization_id:orgState.active,id,...v})});await renderOrganizations(document.getElementById("content"));
 }
 async function renameOrganization(){
  const v=await window.SecondBrainDialog({title:"Rename organization",eyebrow:"Admin",submit:"Save",fields:[{name:"name",label:"Organization name",required:true,value:orgState.detail.organization.name}]});if(!v)return;
  await api("/organizations/update",{method:"POST",body:JSON.stringify({organization_id:orgState.active,name:v.name})});await renderOrganizations(document.getElementById("content"));
 }
 async function changeRole(userId,role){await api("/organizations/update-member",{method:"POST",body:JSON.stringify({organization_id:orgState.active,user_id:userId,role})});window.SecondBrainToast?.("Role updated");await renderOrganizations(document.getElementById("content"))}
 async function removeMember(userId){const v=await window.SecondBrainDialog({title:"Remove team member?",eyebrow:"Organization",submit:"Remove member",html:"<p>This removes the member from the organization workspace. Their personal SecondBrain data is not deleted.</p>"});if(v===null||v===undefined)return;await api("/organizations/remove-member",{method:"POST",body:JSON.stringify({organization_id:orgState.active,user_id:userId})});await renderOrganizations(document.getElementById("content"))}
 async function revokeInvite(id){await api("/organizations/revoke-invite",{method:"POST",body:JSON.stringify({organization_id:orgState.active,invite_id:id})});await renderOrganizations(document.getElementById("content"))}
})();