import { db,config } from "hatchable";
import { COMMERCIAL_PRICES } from "./commercial-pricing.js";

const DEFAULT_FX=94.05;
const MODEL_UNITS={"openai/gpt-oss-20b":1000,"gemini-3.8-flash":500,"gemini-3.5-flash-lite":1500};
function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
async function fxRate(){try{const v=Number(await config.get("USD_INR_REFERENCE_RATE"));if(Number.isFinite(v)&&v>0)return v}catch{}return DEFAULT_FX}
async function activeRates(){
 return (await db.query(`SELECT provider,model,input_microusd_per_million,output_microusd_per_million
 FROM usage_rate_cards WHERE active=true AND meter_key='ai_generation'
 AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now())
 ORDER BY effective_from DESC`)).rows;
}
function unitCostUsd(rate,{outputShare=.5,worstOutput=false}={}){
 if(!rate)return 0;
 const tokens=MODEL_UNITS[rate.model]||1000;
 const inputRate=n(rate.input_microusd_per_million)/1e6;
 const outputRate=n(rate.output_microusd_per_million)/1e6;
 if(worstOutput)return tokens*outputRate/1e6;
 const out=Math.max(0,Math.min(1,outputShare)),inp=1-out;
 return tokens*((inp*inputRate)+(out*outputRate))/1e6;
}
function planRow(code,units,priceInr,costUnitUsd,fx){
 const aiUsd=units*costUnitUsd,aiInr=aiUsd*fx,contribution=priceInr-aiInr;
 return {plan:code,monthly_units:units,price_inr:priceInr,ai_cost_usd:aiUsd,ai_cost_inr:aiInr,ai_variable_contribution_inr:contribution,ai_variable_margin_percent:priceInr>0?contribution/priceInr*100:null};
}
export async function computeUnitEconomics(){
 const [rates,plans,fx,pilot]=await Promise.all([
  activeRates(),
  db.query("SELECT code,monthly_units FROM plan_definitions WHERE active=true ORDER BY monthly_units"),
  fxRate(),
  db.query(`SELECT count(DISTINCT p.user_id) FILTER (WHERE p.status='ACTIVE')::int active_pilot_users,
    count(e.id)::int ai_events_7d,COALESCE(sum(e.quota_units),0)::bigint units_7d,
    COALESCE(sum(e.estimated_cost_microusd) FILTER (WHERE e.priced),0)::bigint cost_microusd_7d,
    count(e.id) FILTER (WHERE e.priced)::int priced_events_7d,
    count(e.id) FILTER (WHERE NOT e.priced)::int unpriced_events_7d
   FROM pilot_participants p
   LEFT JOIN usage_events e ON e.user_id=p.user_id AND e.event_type='ai_generation'
    AND e.source<>'benchmark' AND COALESCE(e.purpose,'') NOT LIKE 'benchmark:%'
    AND e.occurred_at>=now()-interval '7 days'
   WHERE p.cohort='PILOT_1'`)
 ]);
 const byModel={};for(const r of rates)if(!byModel[r.model])byModel[r.model]=r;
 const groq=byModel["openai/gpt-oss-20b"],gemini=byModel["gemini-3.8-flash"],lite=byModel["gemini-3.5-flash-lite"];
 const efficientUnit=0.70*unitCostUsd(groq,{outputShare:.55})+0.25*unitCostUsd(gemini,{outputShare:.55})+0.05*unitCostUsd(lite||gemini,{outputShare:.55});
 const conservativeUnit=0.40*unitCostUsd(groq,{outputShare:.65})+0.60*unitCostUsd(gemini,{outputShare:.65});
 const worstGeminiUnit=unitCostUsd(gemini,{worstOutput:true});
 const defs=Object.fromEntries(plans.rows.map(x=>[x.code,n(x.monthly_units)]));
 const build=(cost)=>["FREE","PLUS","PRO"].map(code=>planRow(code,defs[code]||0,COMMERCIAL_PRICES[code]?.MONTHLY||0,cost,fx));
 const scenarios={efficient:build(efficientUnit),conservative:build(conservativeUnit),worst_case_gemini_output:build(worstGeminiUnit)};
 const p=pilot.rows[0]||{},active=n(p.active_pilot_users),cost7=n(p.cost_microusd_7d)/1e6;
 const projectedMonthlyPerActive=active?cost7/active*(30/7):0;
 const plusEff=scenarios.efficient.find(x=>x.plan==="PLUS"),freeEff=scenarios.efficient.find(x=>x.plan==="FREE");
 const proWorst=scenarios.worst_case_gemini_output.find(x=>x.plan==="PRO");
 return {
  generated_at:new Date().toISOString(),
  assumptions:{usd_inr:fx,fx_reference_date:"2026-11-13",efficient_mix:"70% Groq / 25% Gemini Flash / 5% Flash Lite; 55% output share",conservative_mix:"40% Groq / 60% Gemini Flash; 65% output share",scope:"AI variable cost only; excludes hosting, storage, payment fees, taxes, support, marketing and salaries."},
  provider_unit_costs:{groq_balanced_usd:unitCostUsd(groq,{outputShare:.55}),gemini_flash_balanced_usd:unitCostUsd(gemini,{outputShare:.55}),gemini_flash_worst_output_usd:worstGeminiUnit},
  scenarios,
  pilot:{active_users:active,ai_events_7d:n(p.ai_events_7d),units_7d:n(p.units_7d),known_cost_usd_7d:cost7,projected_monthly_ai_cost_usd_per_active_user:projectedMonthlyPerActive,priced_events_7d:n(p.priced_events_7d),unpriced_events_7d:n(p.unpriced_events_7d)},
  cross_subsidy:{efficient_plus_paid_user_supports_free_users_ai_only:(plusEff&&freeEff&&freeEff.ai_cost_inr>0)?Math.max(0,plusEff.ai_variable_contribution_inr/freeEff.ai_cost_inr):null},
  risk:{pro_worst_case_ai_variable_loss:Boolean(proWorst&&proWorst.ai_variable_contribution_inr<0),status:proWorst&&proWorst.ai_variable_contribution_inr<0?"ROUTING_REQUIRED":"HEALTHY",reason:proWorst&&proWorst.ai_variable_contribution_inr<0?"Pro becomes contribution-negative if its full allowance is consumed almost entirely as expensive Gemini output.":"Current allowances remain contribution-positive under the modeled worst case."}
 };
}