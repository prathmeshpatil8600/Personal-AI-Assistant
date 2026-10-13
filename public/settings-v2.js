(function(){
 window.settings=async function(root){
  const p=await api("/preferences/get");
  const detected=Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";
  const theme=window.SecondBrainDesign?.getTheme?.()||p.theme||"system";
  const accent=window.SecondBrainDesign?.getAccent?.()||"forest";
  const environment=window.SecondBrainLiving?.getEnvironment?.()||"studio";
  const motion=window.SecondBrainLiving?.getMotion?.()||"full";
  const density=window.SecondBrainLiving?.getDensity?.()||"spacious";
  root.innerHTML='<div class="top"><div><div class="eyebrow">Control center</div><h1>Settings</h1><p class="label">Tune how SecondBrain looks, responds, remembers, and connects.</p></div><button class="primary" id="saveSettings">Save changes</button></div>'+
  '<div class="settings-grid">'+
   '<section class="card settings-card"><div class="section-head"><div><h2>Environment</h2><span class="label">Shape the atmosphere without changing your data or assistant behavior.</span></div><div class="environment-preview"><span class="environment-swatch"></span></div></div><div class="form-grid settings-form"><label>Theme<select id="prefTheme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label>Accent<select id="prefAccent"><option value="forest">Forest</option><option value="indigo">Indigo</option><option value="ocean">Ocean</option><option value="amber">Amber</option><option value="rose">Rose</option></select></label><label>Environment<select id="prefEnvironment"><option value="studio">Studio</option><option value="calm">Calm</option><option value="midnight">Midnight</option><option value="nature">Nature</option><option value="minimal">Minimal</option><option value="focus">Focus</option></select></label><label>Motion<select id="prefMotion"><option value="full">Expressive</option><option value="gentle">Gentle</option><option value="reduced">Reduced</option></select></label><label>Density<select id="prefDensity"><option value="spacious">Spacious</option><option value="compact">Compact</option></select></label></div></section>'+
   '<section class="card settings-card"><div class="section-head"><div><h2>Assistant</h2><span class="label">Control language, response depth, and time interpretation.</span></div></div><div class="form-grid settings-form"><label>Language<select id="prefLanguage"><option>English</option><option>Hindi</option><option>Marathi</option></select></label><label>Response style<select id="prefStyle"><option value="concise">Concise</option><option value="balanced">Balanced</option><option value="detailed">Detailed</option></select></label><label>Timezone<input id="prefTimezone" placeholder="Asia/Kolkata"></label></div></section>'+
   '<section class="card settings-card settings-links"><div><h2>Memory & privacy</h2><p class="label">Review what the assistant remembers and the external systems it can use.</p></div><button class="settings-link" data-open="memory"><span><b>Memory</b><small>Review, edit, and forget saved context</small></span><span>→</span></button><button class="settings-link" data-open="integrations"><span><b>Integrations</b><small>Manage connected Google and GitHub accounts</small></span><span>→</span></button><button class="settings-link" data-open="approvals"><span><b>Approvals</b><small>Review sensitive actions before execution</small></span><span>→</span></button><button class="settings-link" data-open="plans"><span><b>Plans & Billing</b><small>Compare plans, usage and subscription status</small></span><span>→</span></button><button class="settings-link" data-open="organizations"><span><b>Organizations</b><small>Manage team workspaces, seats and roles</small></span><span>→</span></button><button class="settings-link" data-open="platform"><span><b>Developer & Platform</b><small>API keys, marketplace, branding and referrals</small></span><span>→</span></button><a class="settings-link" href="/api/account/export" target="_blank" rel="noopener"><span><b>Export my data</b><small>Download a JSON copy of your SecondBrain data</small></span><span>↓</span></a><a class="settings-link" href="/privacy.html" target="_blank" rel="noopener"><span><b>Privacy notice</b><small>How SecondBrain handles personal data</small></span><span>↗</span></a><a class="settings-link" href="/terms.html" target="_blank" rel="noopener"><span><b>Terms</b><small>Pilot terms and service conditions</small></span><span>↗</span></a></section>'+
  '</div>';
  document.getElementById("prefLanguage").value=p.preferred_language||"English";
  document.getElementById("prefStyle").value=p.response_style||"balanced";
  document.getElementById("prefTheme").value=theme;
  document.getElementById("prefAccent").value=accent;
  document.getElementById("prefEnvironment").value=environment;
  document.getElementById("prefMotion").value=motion;
  document.getElementById("prefDensity").value=density;
  document.getElementById("prefTimezone").value=p.timezone||detected;
  document.getElementById("prefTheme").onchange=e=>window.SecondBrainDesign?.setTheme?.(e.target.value);
  document.getElementById("prefAccent").onchange=e=>window.SecondBrainDesign?.setAccent?.(e.target.value);
  document.getElementById("prefEnvironment").onchange=e=>window.SecondBrainLiving?.setEnvironment?.(e.target.value);
  document.getElementById("prefMotion").onchange=e=>window.SecondBrainLiving?.setMotion?.(e.target.value);
  document.getElementById("prefDensity").onchange=e=>window.SecondBrainLiving?.setDensity?.(e.target.value);
  document.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>openSection(b.dataset.open));
  document.getElementById("saveSettings").onclick=saveSettingsV2;
  window.SecondBrainShell?.setContext("Settings");
 };
 async function saveSettingsV2(){
  const theme=document.getElementById("prefTheme").value;
  const accent=document.getElementById("prefAccent").value;
  const environment=document.getElementById("prefEnvironment").value;
  const motion=document.getElementById("prefMotion").value;
  const density=document.getElementById("prefDensity").value;
  window.SecondBrainDesign?.setTheme?.(theme);
  window.SecondBrainDesign?.setAccent?.(accent);
  window.SecondBrainLiving?.setEnvironment?.(environment);
  window.SecondBrainLiving?.setMotion?.(motion);
  window.SecondBrainLiving?.setDensity?.(density);
  await api("/preferences/update",{method:"POST",body:JSON.stringify({
   preferred_language:document.getElementById("prefLanguage").value,
   response_style:document.getElementById("prefStyle").value,
   theme,
   timezone:document.getElementById("prefTimezone").value.trim()
  })});
  const b=document.getElementById("saveSettings");b.textContent="Saved";setTimeout(()=>b.textContent="Save changes",1200);
 }
})();