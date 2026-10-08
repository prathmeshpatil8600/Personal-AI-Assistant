(function(){
 const defs={
  google:{name:"Google Workspace",icon:"G",description:"Gmail, Calendar and Drive"},
  github:{name:"GitHub",icon:"GH",description:"Repositories, issues and pull requests"}
 };
 function dateText(v){if(!v)return"Never";try{return new Date(v).toLocaleString()}catch{return String(v)}}
 function stateOf(s){if(s.connected&&s.reconnect_required)return["Needs reconnect","warning"];if(s.connected)return["Connected","success"];if(s.last_error)return["Attention needed","danger"];return["Not connected","neutral"]}
 function perms(provider){
  return provider==="google"?[
   ["Read Gmail","Search message metadata when you ask."],
   ["Send Gmail","Requires explicit approval before sending."],
   ["Calendar","Read events; creating events requires approval."],
   ["Drive","Search file metadata when requested."]
  ]:[
   ["Repository metadata","Read repository names and metadata."],
   ["Contents","Read repository files when requested."],
   ["Issues","Read issues; creating issues/comments requires approval."],
   ["Pull requests","Read pull-request information."]
  ];
 }
 function card(provider,status){
  const def=defs[provider],st=stateOf(status),identity=provider==="google"?(status.account_email||"Google account"):(status.login||"GitHub account");
  return '<article class="connection-card"><div class="connection-head"><div class="connection-brand"><span class="connection-logo">'+def.icon+'</span><div><h2>'+def.name+'</h2><p>'+def.description+'</p></div></div><span class="status-chip '+st[1]+'">'+st[0]+'</span></div>'+
  '<div class="connection-account"><div><span class="label">Account</span><b>'+(status.connected?esc(identity):"Not connected")+'</b></div><div><span class="label">Last used</span><b>'+esc(dateText(status.last_used_at))+'</b></div></div>'+
  (status.last_error?'<div class="integration-error"><b>Last error</b><span>'+esc(status.last_error)+'</span></div>':'')+
  (status.reconnect_required?'<div class="integration-warning"><b>Reconnect required</b><span>Additional write permissions are needed before approved Gmail or Calendar actions can run.</span></div>':'')+
  '<div class="permission-list">'+perms(provider).map(([a,b])=>'<div class="permission-row"><span class="permission-check">✓</span><div><b>'+a+'</b><small>'+b+'</small></div></div>').join("")+'</div>'+
  '<div class="connection-actions"><button class="primary" data-connect="'+provider+'">'+(status.connected?"Reconnect":"Connect")+'</button>'+(status.connected?'<button class="ghost danger-text" data-disconnect="'+provider+'">Disconnect</button>':'')+'</div></article>';
 }
 window.renderIntegrations=async function(root){
  const [g,h]=await Promise.all([api("/google/status"),api("/github/status")]);
  root.innerHTML='<div class="top"><div><div class="eyebrow">Connected tools</div><h1>Integrations</h1><p class="label">See what SecondBrain can access and which actions require your approval.</p></div></div>'+
  '<div class="trust-banner"><span class="trust-icon">✓</span><div><b>You stay in control</b><p>Sensitive write actions remain behind the approval system.</p></div></div>'+
  '<div class="connection-grid">'+card("google",g)+card("github",h)+'</div>';
  root.querySelectorAll("[data-connect]").forEach(b=>b.onclick=()=>window.connectIntegration(b.dataset.connect));
  root.querySelectorAll("[data-disconnect]").forEach(b=>b.onclick=()=>disconnectIntegration(b.dataset.disconnect));
  window.SecondBrainShell?.setContext("Integrations");
 };
 window.connectIntegration=async function(provider){
  try{const r=await api("/"+provider+"/start");if(r?.authorization_url)location.href=r.authorization_url;else window.SecondBrainToast?.("Connection setup is incomplete.")}catch(e){window.SecondBrainToast?.(e.message)}
 };
 async function disconnectIntegration(provider){
  const name=defs[provider].name;
  if(!confirm("Disconnect "+name+"?"))return;
  await api("/"+provider+"/status",{method:"DELETE"});
  await window.renderIntegrations(document.getElementById("content"));
  window.SecondBrainShell?.refreshConnections?.();
 }
})();