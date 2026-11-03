(function(){
 let billingCycle="MONTHLY";
 let monetizationState=null;

 function money(v){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(v)||0)}
 function pct(used,total){if(!total)return 0;return Math.max(0,Math.min(100,Math.round((used/total)*100)))}
 function featureLabel(key){
  return ({chat:"AI chat",documents:"Documents",google_integration:"Google integration",github_integration:"GitHub integration",scheduled_briefings:"Scheduled briefings",advanced_automation:"Advanced automation",premium_models:"Premium models",max_documents:"Document allowance",max_memory_items:"Memory allowance"}[key]||key.replaceAll("_"," "));
 }
 function planDescription(code){
  return code==="FREE"?"Try SecondBrain and build a daily habit.":code==="PLUS"?"The complete personal assistant for regular use.":"For professionals who want deeper AI and automation.";
 }
 function priceLine(plan){
  const price=plan.prices_inr?.[billingCycle];
  if(plan.code==="FREE")return '<div class="plan-price"><b>Free</b><small>No card required</small></div>';
  return '<div class="plan-price"><b>'+money(price)+'</b><small>'+(billingCycle==="MONTHLY"?"/ month":"/ year")+' · test price</small></div>';
 }
 function features(plan){
  const e=plan.entitlements||{},items=[];
  items.push(plan.monthly_units.toLocaleString("en-IN")+" monthly usage units");
  if(plan.code==="FREE"){
   items.push("AI Chat");
   items.push("Today & Focus planning");
   items.push("Tasks, Notes, Goals & Reminders");
   items.push("Unified Search");
   items.push("Productivity & Weekly Review");
  }
  if(Number.isFinite(Number(e.max_documents)))items.push(e.max_documents+" documents");
  if(Number.isFinite(Number(e.max_memory_items)))items.push(e.max_memory_items+" saved memories");
  if(plan.code==="FREE"){
   items.push("Privacy controls & data export");
   items.push("Guide & Help");
  }
  ["google_integration","github_integration","scheduled_briefings","advanced_automation","premium_models"].forEach(k=>{if(e[k])items.push(featureLabel(k))});
  return items;
 }
 function planCard(plan,current,billing){
  const isCurrent=current.plan.code===plan.code;
  const available=plan.code==="FREE"||plan.billing_available?.[billingCycle];
  const disabled=isCurrent||!available||plan.code==="FREE";
  const label=isCurrent?"Current plan":plan.code==="FREE"?"Included":available?"Choose "+plan.display_name:"Billing setup pending";
  return '<article class="pricing-card '+(plan.code==="PLUS"?"featured ":"")+(isCurrent?"current":"")+'">'+
   '<div class="pricing-card-head"><div><span class="plan-kicker">'+esc(plan.display_name)+'</span><h2>'+esc(planDescription(plan.code))+'</h2></div>'+(plan.code==="PLUS"?'<span class="recommended">Most popular</span>':'')+'</div>'+
   priceLine(plan)+
   '<ul class="plan-features">'+features(plan).map(x=>'<li><span>✓</span>'+esc(x)+'</li>').join("")+'</ul>'+
   '<button class="'+(plan.code==="PRO"?"secondary":"primary")+' plan-select" data-plan="'+plan.code+'" '+(disabled?"disabled":"")+'>'+esc(label)+'</button>'+
   (!available&&plan.code!=="FREE"?'<p class="setup-note">Add the Razorpay plan ID later to enable checkout.</p>':'')+
  '</article>';
 }
 function billingCard(sub){
  if(!sub)return '<section class="card billing-card"><div><div class="eyebrow">Billing</div><h2>No paid subscription</h2><p class="label">You are currently using the Free plan. Upgrade when you need more capacity or connected tools.</p></div></section>';
  const active=!["CANCELLED","COMPLETED","EXPIRED"].includes(sub.status);
  return '<section class="card billing-card"><div class="section-head"><div><div class="eyebrow">Billing</div><h2>'+esc(sub.plan_code)+' · '+esc(sub.billing_cycle.toLowerCase())+'</h2></div><span class="status-chip '+(sub.status==="ACTIVE"?"success":sub.status==="PAST_DUE"?"warning":"neutral")+'">'+esc(sub.status)+'</span></div>'+
   '<div class="billing-facts"><div><span>Provider</span><b>Razorpay</b></div><div><span>Current period ends</span><b>'+esc(sub.current_period_end?new Date(sub.current_period_end).toLocaleDateString():"—")+'</b></div><div><span>Cancellation</span><b>'+(sub.cancel_at_period_end?"Ends this cycle":"Renews normally")+'</b></div></div>'+
   '<div class="billing-actions"><button class="ghost" id="refreshBilling">Refresh status</button>'+(sub.hosted_url&&["CREATED","AUTHENTICATED"].includes(sub.status)?'<button class="secondary" id="resumeCheckout">Resume checkout</button>':'')+(active?'<button class="ghost danger-text" id="cancelBilling">Cancel subscription</button>':'')+'</div></section>';
 }

 window.renderPlans=async function(root){
  const [catalog,current,billing,addons,addonHistory]=await Promise.all([api("/monetization/catalog"),api("/plan/status"),api("/billing/status"),api("/addons/catalog"),api("/addons/history")]);
  monetizationState={catalog,current,billing,addons,addonHistory};
  const used=current.usage.used_units,total=current.usage.allowance_units,percent=pct(used,total);
  root.innerHTML='<div class="top pricing-top"><div><div class="eyebrow">Plans & billing</div><h1>Choose how much SecondBrain can do for you</h1><p class="label">Free answers when you ask. Plus connects your personal workspace. Pro is designed for deeper AI and automation.</p></div><div class="cycle-toggle" role="group" aria-label="Billing cycle"><button data-cycle="MONTHLY" class="'+(billingCycle==="MONTHLY"?"active":"")+'">Monthly</button><button data-cycle="ANNUAL" class="'+(billingCycle==="ANNUAL"?"active":"")+'">Annual</button></div></div>'+
  '<div class="pricing-notice"><b>Test pricing</b><span>These are provisional launch prices. We will finalize them after B1/B5 cost and margin data is strong enough.</span></div>'+
  '<section class="usage-card card"><div class="usage-copy"><div><span class="eyebrow">Current plan</span><h2>'+esc(current.plan.name)+'</h2></div><div class="usage-numbers"><b>'+used.toLocaleString("en-IN")+'</b><span>of '+total.toLocaleString("en-IN")+' monthly units</span></div></div><div class="usage-track"><span style="width:'+percent+'%"></span></div><div class="usage-foot"><span>'+percent+'% used</span><span>'+current.usage.remaining_units.toLocaleString("en-IN")+' remaining · resets '+new Date(current.period.end).toLocaleDateString()+'</span></div></section>'+
  '<div class="pricing-grid">'+catalog.plans.map(p=>planCard(p,current,billing.subscription)).join("")+'</div>'+
  '<section class="plan-principles"><div><b>No “unlimited AI” promise</b><span>Usage allowances protect reliability and keep costs sustainable.</span></div><div><b>Upgrade only when useful</b><span>Your existing data stays with you when your plan changes.</span></div><div><b>Sensitive actions stay approved</b><span>Higher plans do not bypass the approval system.</span></div></section>'+
  billingCard(billing.subscription)+renderAddonSection(addons,addonHistory,current);

  root.querySelectorAll("[data-cycle]").forEach(b=>b.onclick=()=>{billingCycle=b.dataset.cycle;renderPlans(root)});
  root.querySelectorAll(".plan-select[data-plan]").forEach(b=>b.onclick=()=>startUpgrade(b.dataset.plan,b));
  document.getElementById("refreshBilling")?.addEventListener("click",()=>refreshBilling(root));
  document.getElementById("resumeCheckout")?.addEventListener("click",()=>safeBillingRedirect(billing.subscription?.hosted_url));
  document.getElementById("cancelBilling")?.addEventListener("click",()=>cancelSubscription(root));
  root.querySelectorAll("[data-addon]").forEach(b=>b.onclick=()=>startAddonPurchase(b.dataset.addon,b,root));
  window.SecondBrainShell?.setContext("Plans & Billing");
 };

 async function startUpgrade(planCode,button){
  if(!["PLUS","PRO"].includes(planCode))return;
  button.disabled=true;const old=button.textContent;button.textContent="Preparing checkout…";
  try{
   const d=await api("/billing/create",{method:"POST",body:JSON.stringify({plan_code:planCode,billing_cycle:billingCycle})});
   if(!d?.hosted_url)throw new Error("Secure hosted checkout is not available yet.");
   safeBillingRedirect(d.hosted_url);
  }catch(e){window.SecondBrainToast?.(e.message||"Unable to start checkout.");button.disabled=false;button.textContent=old}
 }
 function safeBillingRedirect(url){
  if(!url)return;
  try{
   const u=new URL(url,location.origin);
   if(u.protocol!=="https:"||!(u.hostname==="rzp.io"||u.hostname.endsWith(".razorpay.com")||u.hostname==="razorpay.com"))throw new Error("Checkout URL is not an approved Razorpay destination.");
   location.href=u.href;
  }catch{window.SecondBrainToast?.("Unable to open the secure billing page.")}
 }
 async function refreshBilling(root){
  const b=document.getElementById("refreshBilling");if(b){b.disabled=true;b.textContent="Refreshing…"}
  try{await api("/billing/status?refresh=1");window.SecondBrainToast?.("Billing status refreshed");await renderPlans(root)}catch(e){window.SecondBrainToast?.(e.message)}
 }
 async function cancelSubscription(root){
  const v=await window.SecondBrainDialog?.({title:"Cancel subscription",eyebrow:"Billing",submit:"Cancel at period end",html:'<p>Your paid access will remain active until the current billing period ends. After that, your account returns to Free limits. Your workspace data is not deleted.</p>'});
  if(v===null||v===undefined)return;
  try{await api("/billing/cancel",{method:"POST",body:JSON.stringify({mode:"period_end"})});window.SecondBrainToast?.("Subscription set to cancel at period end");await renderPlans(root)}catch(e){window.SecondBrainToast?.(e.message)}
 }

 function addonEffectText(e){
  const bits=[];
  if(Number(e?.quota_units)>0)bits.push("+"+Number(e.quota_units).toLocaleString("en-IN")+" usage units");
  if(Number(e?.max_documents)>0)bits.push("+"+Number(e.max_documents)+" document slots");
  if(Array.isArray(e?.feature_flags)&&e.feature_flags.length)bits.push(e.feature_flags.map(featureLabel).join(", "));
  return bits.join(" · ")||"Additional capacity";
 }
 function renderAddonSection(data,history,current){
  const active=data?.active_effects||{},hasActive=Number(active.quota_units)>0||Number(active.max_documents)>0||(active.feature_flags||[]).length>0;
  const cards=(data?.addons||[]).map(a=>'<article class="addon-card '+(!a.eligible?"locked":"")+'"><div><span class="plan-kicker">'+esc(a.display_name)+'</span><h3>'+esc(a.description)+'</h3></div><div class="addon-price"><b>'+money(a.price_inr)+'</b><small>one-time · test price</small></div><p class="addon-effect">'+esc(addonEffectText(a.effects))+'</p><p class="label">'+(a.validity_days?esc(a.validity_days+" days validity"):"No fixed expiry")+'</p><button class="secondary" data-addon="'+esc(a.code)+'" '+(!a.eligible||!data.billing_available?"disabled":"")+'>'+(a.eligible?(data.billing_available?"Buy add-on":"Razorpay setup pending"):"Not available on "+esc(current.plan.code))+'</button></article>').join("");
  const recent=(history||[]).slice(0,6).map(h=>'<div class="addon-history-row"><div><b>'+esc(h.display_name)+'</b><small>'+new Date(h.created_at).toLocaleDateString()+'</small></div><span class="status-chip '+(h.status==="PAID"?"success":h.status==="REFUNDED"?"warning":"neutral")+'">'+esc(h.status)+'</span></div>').join("");
  return '<section class="addon-section"><div class="section-head"><div><div class="eyebrow">Add-ons</div><h2>Need a temporary boost?</h2><p class="label">Add-ons increase capacity without changing your base plan.</p></div></div>'+
   (hasActive?'<div class="active-addon-banner"><b>Active boosts</b><span>'+esc(addonEffectText(active))+'</span></div>':'')+
   '<div class="addon-grid">'+cards+'</div>'+
   '<div class="card addon-history"><div class="section-head"><h3>Recent add-on purchases</h3></div>'+(recent||'<div class="daily-empty compact">No add-on purchases yet.</div>')+'</div></section>';
 }
 function loadRazorpayCheckout(){
  if(window.Razorpay)return Promise.resolve();
  return new Promise((resolve,reject)=>{
   const existing=document.querySelector('script[data-razorpay-checkout]');
   if(existing){existing.addEventListener("load",resolve,{once:true});existing.addEventListener("error",reject,{once:true});return}
   const s=document.createElement("script");s.src="https://checkout.razorpay.com/v1/checkout.js";s.async=true;s.dataset.razorpayCheckout="true";s.onload=resolve;s.onerror=()=>reject(new Error("Unable to load Razorpay checkout."));document.head.appendChild(s);
  });
 }
 async function startAddonPurchase(code,button,root){
  if(!code||button.disabled)return;
  const old=button.textContent;button.disabled=true;button.textContent="Preparing…";
  try{
   const order=await api("/addons/create",{method:"POST",body:JSON.stringify({addon_code:code})});
   await loadRazorpayCheckout();
   const rz=new window.Razorpay({
    key:order.key_id,order_id:order.order_id,amount:order.amount_paise,currency:order.currency,
    name:"SecondBrain",description:order.addon?.display_name||"Add-on",
    handler:async function(result){
     try{
      await api("/addons/verify",{method:"POST",body:JSON.stringify(result)});
      window.SecondBrainToast?.("Add-on activated");
      await renderPlans(root);
     }catch(e){window.SecondBrainToast?.(e.message||"Payment verification failed.")}
    },
    modal:{ondismiss:function(){button.disabled=false;button.textContent=old}}
   });
   rz.open();
  }catch(e){window.SecondBrainToast?.(e.message||"Unable to start add-on checkout.");button.disabled=false;button.textContent=old}
 }

 function openUpgradePrompt(detail){
  const reason=detail?.code||"MONTHLY_LIMIT";
  const title=reason==="FEATURE_NOT_INCLUDED"?"This feature needs a higher plan":"You’ve reached your current allowance";
  const copy=reason==="FEATURE_NOT_INCLUDED"?"Your current plan does not include this capability. Compare Plus and Pro to see which tier fits.":"Your workspace is safe. Upgrade for more monthly capacity, or wait until your allowance resets.";
  window.SecondBrainDialog?.({title,eyebrow:"Plan limit",submit:"View plans",html:'<div class="upgrade-prompt"><p>'+esc(copy)+'</p><div class="limit-summary"><span>Current plan</span><b>'+esc(detail?.plan||"FREE")+'</b></div></div>'}).then(v=>{if(v!==null&&v!==undefined)openSection("plans")});
 }

 window.addEventListener("secondbrain:entitlement",e=>openUpgradePrompt(e.detail||{}));
})();