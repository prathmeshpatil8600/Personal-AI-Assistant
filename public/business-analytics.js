(function(){
 function inr(v){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(v)||0)}
 function usd(v){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(Number(v)||0)}
 function num(v){return Number(v||0).toLocaleString("en-IN")}
 function pct(v){return (Number(v||0)).toFixed(1)+"%"}
 function metric(label,value,sub){return '<div class="biz-metric card"><span>'+esc(label)+'</span><b>'+esc(value)+'</b><small>'+esc(sub||"")+'</small></div>'}
 function table(rows,cols){
  if(!rows?.length)return '<div class="daily-empty compact">No data yet.</div>';
  return '<div class="biz-table-wrap"><table class="biz-table"><thead><tr>'+cols.map(c=>'<th>'+esc(c.label)+'</th>').join("")+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+cols.map(c=>'<td>'+esc(c.format?c.format(r[c.key],r):r[c.key]??"—")+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>';
 }
 window.renderBusinessAnalytics=async function(root){
  const [d,trends]=await Promise.all([api("/business/overview"),api("/business/trends?days=90")]);
  const marginReady=d.margin?.status!=="UNAVAILABLE_CURRENCY_MISMATCH";
  root.innerHTML='<div class="top"><div><div class="eyebrow">Internal economics</div><h1>Business Analytics</h1><p class="label">Revenue, conversion, usage economics and risk signals. Admin only.</p></div><button class="ghost" id="refreshBusiness">Refresh</button></div>'+
  '<div class="biz-grid">'+
   metric("MRR",inr(d.revenue.mrr_inr),"Provisional pricing basis")+
   metric("ARR",inr(d.revenue.arr_inr),"MRR × 12")+
   metric("Paid users",num(d.revenue.active_paid_users),pct(d.users.paid_conversion_percent)+" conversion")+
   metric("ARPU",inr(d.revenue.arpu_inr),"Active paid users")+
   metric("Known provider cost",usd(d.cost.priced_cost_usd),pct(d.cost.cost_coverage_percent)+" of events priced")+
   metric("Monthly usage units",num(d.usage.month_quota_units),num(d.usage.events)+" events")+
  '</div>'+
  '<div class="biz-alert '+(marginReady?"ok":"warn")+'"><b>'+(marginReady?"Margin ready":"Gross margin not ready")+'</b><span>'+esc(d.margin.reason||"Cost and revenue use a consistent currency basis.")+'</span></div>'+
  '<div class="biz-columns">'+
   '<section class="card"><div class="section-head"><div><h2>Subscriptions</h2><span class="label">Current lifecycle distribution</span></div></div>'+table(d.subscriptions.breakdown,[{key:"plan_code",label:"Plan"},{key:"billing_cycle",label:"Cycle"},{key:"status",label:"Status"},{key:"users",label:"Users"}])+
    '<div class="biz-risk-row"><div><span>Past due</span><b>'+num(d.subscriptions.past_due)+'</b></div><div><span>Scheduled cancels</span><b>'+num(d.subscriptions.scheduled_cancellations)+'</b></div><div><span>Cancelled 30d</span><b>'+num(d.subscriptions.cancelled_30d)+'</b></div></div></section>'+
   '<section class="card"><div class="section-head"><div><h2>Usage by plan</h2><span class="label">Current calendar month</span></div></div>'+table(d.usage.by_plan,[{key:"plan_code",label:"Plan"},{key:"events",label:"Events"},{key:"quota_units",label:"Units"},{key:"priced_cost_microusd",label:"Known cost",format:v=>usd(Number(v||0)/1000000)},{key:"unpriced_events",label:"Unpriced"}])+'</section>'+
  '</div>'+
  '<section class="card biz-section"><div class="section-head"><div><h2>Cost drivers</h2><span class="label">Which operations consume the most quota and known provider cost.</span></div></div>'+table(d.usage.by_type,[{key:"event_type",label:"Type"},{key:"events",label:"Events"},{key:"quota_units",label:"Units"},{key:"priced_cost_microusd",label:"Known cost",format:v=>usd(Number(v||0)/1000000)},{key:"unpriced_events",label:"Unpriced"}])+'</section>'+
  '<section class="card biz-section"><div class="section-head"><div><h2>High-usage users</h2><span class="label">Privacy-preserving references; no account IDs are exposed here.</span></div></div>'+table(d.high_usage_users,[{key:"user_ref",label:"User ref"},{key:"plan_code",label:"Plan"},{key:"events",label:"Events"},{key:"quota_units",label:"Units"},{key:"priced_cost_microusd",label:"Known cost",format:v=>usd(Number(v||0)/1000000)},{key:"unpriced_events",label:"Unpriced"}])+'</section>'+
  '<section class="card biz-section"><div class="section-head"><div><h2>90-day trend readiness</h2><span class="label">Daily snapshots populate automatically; there may be little history initially.</span></div></div><div class="biz-trend-summary"><div><b>'+num(trends.points?.length||0)+'</b><span>daily snapshots</span></div><div><b>'+num(d.cost.unpriced_events)+'</b><span>unpriced events this month</span></div><div><b>'+pct(d.cost.cost_coverage_percent)+'</b><span>cost coverage</span></div></div></section>'+
  '<p class="biz-footnote">Revenue uses provisional test pricing. Provider cost uses configured B1 rate cards only. Do not make final pricing decisions until cost coverage and currency normalization are complete.</p>';
  document.getElementById("refreshBusiness").onclick=()=>renderBusinessAnalytics(root);
  window.SecondBrainShell?.setContext("Business Analytics");
 };
})();