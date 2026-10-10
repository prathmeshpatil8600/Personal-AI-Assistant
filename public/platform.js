(function(){
 let platformState={orgs:[],activeOrg:null};
 function keyRow(k){return '<div class="platform-key-row"><div><b>'+esc(k.name)+'</b><small>'+esc(k.key_prefix)+' · '+esc((k.scopes||[]).join(", "))+'</small></div><div class="platform-key-actions"><span class="status-chip '+(k.status==="ACTIVE"?"success":"neutral")+'">'+esc(k.status)+'</span>'+(k.status==="ACTIVE"?'<button class="ghost" data-revoke-key="'+k.id+'">Revoke</button>':'')+'</div></div>'}
 function integrationCard(i,installed){
  const active=installed?.status==="ACTIVE";
  return '<article class="integration-market-card"><div><span class="plan-kicker">'+esc(i.category)+'</span><h3>'+esc(i.display_name)+'</h3><p>'+esc(i.description)+'</p><small>'+esc((i.permissions||[]).join(" · "))+'</small></div><button class="'+(active?"ghost":"secondary")+'" data-integration="'+esc(i.slug)+'" data-action="'+(active?"remove":"install")+'" '+(i.status!=="AVAILABLE"?"disabled":"")+'>'+(i.status!=="AVAILABLE"?"Coming soon":active?"Remove":"Install")+'</button></article>';
 }
 window.renderPlatform=async function(root){
  const [plan,keys,orgs,partner]=await Promise.all([api("/plan/status"),api("/developer/keys"),api("/organizations/list"),api("/partners/status")]);
  platformState.orgs=orgs||[];if(!platformState.activeOrg&&platformState.orgs.length)platformState.activeOrg=platformState.orgs[0].id;
  let marketplace={catalog:[],installations:[]},branding=null;
  if(platformState.activeOrg){
   [marketplace,branding]=await Promise.all([api("/platform/marketplace?organization_id="+encodeURIComponent(platformState.activeOrg)),api("/platform/white-label?organization_id="+encodeURIComponent(platformState.activeOrg))]);
  }else marketplace=await api("/platform/marketplace");
  const apiAllowed=plan.plan.platform_entitlements?.api_access===true&&plan.plan.status==="ACTIVE";
  root.innerHTML='<div class="top"><div><div class="eyebrow">Platform expansion</div><h1>Developer & Platform</h1><p class="label">API access, integration marketplace, organization branding, and partner attribution.</p></div></div>'+
   '<div class="platform-grid">'+
    '<section class="card platform-card"><div class="section-head"><div><h2>Developer API</h2><span class="label">Scoped, revocable keys. Raw secrets are shown once.</span></div>'+(apiAllowed?'<button class="primary" id="createApiKey">+ API key</button>':'')+'</div>'+
      (!apiAllowed?'<div class="platform-notice">Developer API access currently requires an active Pro plan.</div>':'')+
      '<div class="platform-key-list">'+((keys||[]).length?keys.map(keyRow).join(""):'<div class="daily-empty compact">No API keys yet.</div>')+'</div>'+
      '<div class="api-example"><b>Read-only API foundation</b><code>GET /api/v1/me</code><code>GET /api/v1/usage</code><small>Use Authorization: Bearer &lt;api_key&gt;</small></div>'+
    '</section>'+
    '<section class="card platform-card"><div class="section-head"><div><h2>Partner attribution</h2><span class="label">One account can be attributed once.</span></div></div>'+
      (partner.attribution?'<div class="partner-attribution"><b>'+esc(partner.attribution.partner_name)+'</b><span>'+esc(partner.attribution.partner_code)+(partner.attribution.campaign?' · '+esc(partner.attribution.campaign):'')+'</span></div>':'<button class="secondary" id="claimPartner">Add referral code</button>')+
    '</section>'+
   '</div>'+
   '<section class="card platform-card platform-org"><div class="section-head"><div><h2>Organization platform</h2><span class="label">Install curated integrations and configure brand settings.</span></div>'+(platformState.orgs.length?'<select id="platformOrg">'+platformState.orgs.map(o=>'<option value="'+o.id+'" '+(o.id===platformState.activeOrg?"selected":"")+'>'+esc(o.name)+'</option>').join("")+'</select>':'')+'</div>'+
    (platformState.orgs.length?'<div class="marketplace-grid">'+marketplace.catalog.map(i=>integrationCard(i,(marketplace.installations||[]).find(x=>x.integration_slug===i.slug))).join("")+'</div>'+renderBranding(branding,platformState.orgs.find(x=>x.id===platformState.activeOrg)):'<div class="daily-empty">Create or join an organization to use team marketplace and white-label foundations.</div>')+
   '</section>'+
   '<div class="platform-footnote">External API access remains a foundation until the app is made public and end-user authentication is migrated from collaborator-only access.</div>';
  document.getElementById("createApiKey")?.addEventListener("click",createApiKey);
  document.getElementById("claimPartner")?.addEventListener("click",claimPartner);
  document.getElementById("platformOrg")?.addEventListener("change",async e=>{platformState.activeOrg=e.target.value;await renderPlatform(root)});
  root.querySelectorAll("[data-revoke-key]").forEach(b=>b.onclick=()=>revokeKey(b.dataset.revokeKey));
  root.querySelectorAll("[data-integration]").forEach(b=>b.onclick=()=>toggleIntegration(b.dataset.integration,b.dataset.action));
  document.getElementById("saveBranding")?.addEventListener("click",saveBranding);
  window.SecondBrainShell?.setContext("Developer & Platform");
 }
 function renderBranding(b,o){
  if(!b)return "";
  const canEnable=o?.business_tier==="BUSINESS_CUSTOM"&&o?.billing_status==="ACTIVE";
  return '<div class="white-label-panel"><div class="section-head"><div><h3>White-label readiness</h3><span class="label">Structured branding only; no custom HTML or CSS injection.</span></div></div><div class="form-grid"><label>Brand name<input id="wlBrand" value="'+esc(b.brand_name||o?.name||"")+'"></label><label>Accent<select id="wlAccent"><option value="forest">Forest</option><option value="indigo">Indigo</option><option value="ocean">Ocean</option><option value="amber">Amber</option><option value="rose">Rose</option></select></label><label>HTTPS logo URL<input id="wlLogo" value="'+esc(b.logo_url||"")+'" placeholder="https://..."></label><label>Support email<input id="wlSupport" value="'+esc(b.support_email||"")+'" placeholder="support@company.com"></label><label class="wide">Welcome message<textarea id="wlWelcome" rows="3">'+esc(b.welcome_message||"")+'</textarea></label></div><label class="toggle-row"><input type="checkbox" id="wlEnabled" '+(b.enabled?"checked":"")+' '+(!canEnable?"disabled":"")+'><span>Enable white-label experience '+(!canEnable?"(requires active custom Business plan)":"")+'</span></label><button class="secondary" id="saveBranding">Save branding</button></div>';
 }
 async function createApiKey(){
  const v=await window.SecondBrainDialog({title:"Create API key",eyebrow:"Developer",submit:"Create key",fields:[{name:"name",label:"Key name",required:true,placeholder:"My integration"},{name:"scopes",label:"Scope",type:"select",value:"profile:read",options:[{value:"profile:read",label:"Profile read"},{value:"usage:read",label:"Usage read"}]}]});if(!v)return;
  const r=await api("/developer/create-key",{method:"POST",body:JSON.stringify({name:v.name,scopes:[v.scopes]})});
  await window.SecondBrainDialog({title:"API key created",eyebrow:"Copy now",submit:"Close",html:'<p>This secret is shown only once.</p><pre class="approval-input">'+esc(r.api_key)+'</pre><p class="label">'+esc(r.warning)+'</p>'});
  await renderPlatform(document.getElementById("content"));
 }
 async function revokeKey(id){const v=await window.SecondBrainDialog({title:"Revoke API key?",eyebrow:"Developer",submit:"Revoke",html:"<p>Requests using this key will stop immediately.</p>"});if(v===null||v===undefined)return;await api("/developer/revoke-key",{method:"POST",body:JSON.stringify({id})});await renderPlatform(document.getElementById("content"))}
 async function claimPartner(){const v=await window.SecondBrainDialog({title:"Referral code",eyebrow:"Partner",submit:"Apply",fields:[{name:"code",label:"Code",required:true}]});if(!v)return;await api("/partners/claim",{method:"POST",body:JSON.stringify(v)});await renderPlatform(document.getElementById("content"))}
 async function toggleIntegration(slug,action){const path=action==="install"?"/platform/install":"/platform/uninstall";await api(path,{method:"POST",body:JSON.stringify({organization_id:platformState.activeOrg,integration_slug:slug})});window.SecondBrainToast?.(action==="install"?"Integration installed":"Integration removed");await renderPlatform(document.getElementById("content"))}
 async function saveBranding(){
  const body={organization_id:platformState.activeOrg,brand_name:document.getElementById("wlBrand").value.trim(),accent_key:document.getElementById("wlAccent").value,logo_url:document.getElementById("wlLogo").value.trim(),support_email:document.getElementById("wlSupport").value.trim(),welcome_message:document.getElementById("wlWelcome").value.trim(),enabled:document.getElementById("wlEnabled").checked};
  await api("/platform/white-label",{method:"POST",body:JSON.stringify(body)});window.SecondBrainToast?.("Brand settings saved");await renderPlatform(document.getElementById("content"));
 }
})();