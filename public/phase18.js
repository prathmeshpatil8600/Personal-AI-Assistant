(()=> {
 const ENV_KEY="secondbrain.environment";
 const valid=new Set(["studio","calm","midnight","nature","minimal","focus"]);
 function defaultEnvironment(){
  const h=new Date().getHours();
  if(h>=21||h<6)return "midnight";
  if(h<10)return "calm";
  return "studio";
 }
 function applyEnvironment(name){
  const env=valid.has(name)?name:defaultEnvironment();
  document.documentElement.dataset.environment=env;
  if(valid.has(name))localStorage.setItem(ENV_KEY,name);
  window.dispatchEvent(new CustomEvent("secondbrain:environment",{detail:{environment:env}}));
  return env;
 }
 function mountAmbient(){
  if(!document.querySelector(".living-background")){
   const bg=document.createElement("div");
   bg.className="living-background";
   bg.setAttribute("aria-hidden","true");
   bg.innerHTML='<span class="living-aurora a"></span><span class="living-aurora b"></span><span class="living-grain"></span>';
   document.body.prepend(bg);
  }
  if(!document.querySelector(".living-presence")){
   const p=document.createElement("div");
   p.className="living-presence";
   p.dataset.state="calm";
   p.setAttribute("aria-hidden","true");
   p.innerHTML='<span class="living-presence-orb"></span><span class="living-presence-label">ready</span>';
   document.body.appendChild(p);
  }
 }
 function setPresence(state="calm",label){
  const p=document.querySelector(".living-presence");if(!p)return;
  const safe=["calm","thinking","working","attention"].includes(state)?state:"calm";
  p.dataset.state=safe;
  const l=p.querySelector(".living-presence-label");
  if(l)l.textContent=label||({calm:"ready",thinking:"thinking",working:"working",attention:"needs attention"}[safe]);
 }
 function markPageState(section){
  document.body.dataset.livingSection=section||"";
  const focus=section==="focus";
  if(focus&&!localStorage.getItem(ENV_KEY))document.documentElement.dataset.environment="focus";
  else if(!localStorage.getItem(ENV_KEY))document.documentElement.dataset.environment=defaultEnvironment();
  setPresence("calm","ready");
 }
 const stored=localStorage.getItem(ENV_KEY);
 applyEnvironment(stored||defaultEnvironment());
 function start(){mountAmbient();const old=window.SecondBrainShell?.setContext;if(window.SecondBrainShell&&old&&!old.__livingWrapped){const wrapped=function(label){old.call(window.SecondBrainShell,label);markPageState(String(label||"").toLowerCase())};wrapped.__livingWrapped=true;window.SecondBrainShell.setContext=wrapped}}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
 window.SecondBrainLiving={setEnvironment:applyEnvironment,getEnvironment:()=>document.documentElement.dataset.environment||defaultEnvironment(),environments:[...valid],setPresence,markPageState};
 window.addEventListener("secondbrain:assistant-state",e=>setPresence(e.detail?.state,e.detail?.label));
})();