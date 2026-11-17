import { db } from "hatchable";
import { computePilotMeasurement } from "./pilot-measurement.js";
import { computeUnitEconomics } from "./unit-economics.js";

const n=v=>Number(v||0);
const round=(v,d=1)=>Math.round(n(v)*10**d)/10**d;

export async function computePilotDecision(cohort="PILOT_1"){
 const [pilot,econ,plans]=await Promise.all([
  computePilotMeasurement(cohort),
  computeUnitEconomics(),
  db.query("SELECT code,monthly_units FROM plan_definitions WHERE active=true")
 ]);
 const m=pilot.metrics||{},defs=Object.fromEntries(plans.rows.map(x=>[x.code,n(x.monthly_units)]));
 const active=n(m.active),units7=n(m.units_7d),requests7=n(m.requests_7d);
 const projectedUnitsPerActive=active?units7/active*(30/7):0;
 const projectedRequestsPerActive=active?requests7/active*(30/7):0;
 const freeUnits=defs.FREE||200,plusUnits=defs.PLUS||2000,proUnits=defs.PRO||10000;
 const freeUtilization=freeUnits?projectedUnitsPerActive/freeUnits*100:0;

 const mature=n(m.d7_eligible)>=3&&active>=3;
 const healthyActivation=n(m.first_chat_percent)>=70&&n(m.onboarding_percent)>=50;
 const healthyRetention=n(m.d7_percent)>=40;
 const severeIssues=n(m.critical_open)>0||n(m.high_open)>=3;

 let cohortDecision="COLLECT_MORE_DATA";
 const reasons=[];
 if(severeIssues){cohortDecision="PAUSE";reasons.push("Severe unresolved feedback is present.");}
 else if(n(m.cohort_size)<5){cohortDecision="FILL_TO_5";reasons.push("Wave 1 has fewer than five invited/active participants.");}
 else if(!mature){cohortDecision="HOLD_AT_5";reasons.push("At least three users need mature Day-7 data before expansion.");}
 else if(healthyActivation&&healthyRetention){cohortDecision="EXPAND_TO_10";reasons.push("Activation, onboarding and Day-7 retention meet the expansion gate.");}
 else {cohortDecision="HOLD_AT_5";reasons.push("Day-7 data is mature but activation/retention is below target.");}

 let freeRecommendation="KEEP_200";
 if(mature&&freeUtilization>85)freeRecommendation="INCREASE_OR_REPRICE_UNITS";
 else if(mature&&freeUtilization<25&&projectedRequestsPerActive>=8)freeRecommendation="KEEP_200_ROOMY";
 else if(mature&&freeUtilization<10&&projectedRequestsPerActive<4)freeRecommendation="TOO_LITTLE_USAGE_TO_CALIBRATE";

 const plusMargin=n(econ.scenarios?.conservative?.find(x=>x.plan==="PLUS")?.ai_variable_margin_percent);
 const proMargin=n(econ.scenarios?.conservative?.find(x=>x.plan==="PRO")?.ai_variable_margin_percent);
 const plusRecommendation=plusMargin>=60?"KEEP_499":"REVIEW_PRICE_OR_ALLOWANCE";
 const proRecommendation=proMargin>=45&&!econ.risk?.pro_worst_case_ai_variable_loss?"KEEP_1499":"KEEP_1499_WITH_GUARDRAIL";

 const confidence=mature&&requests7>=20?"MEDIUM":mature?"LOW":"INSUFFICIENT";
 if(confidence==="INSUFFICIENT")reasons.push("Pricing calibration is provisional until Day-7 usage is mature.");
 if(requests7<20)reasons.push("Fewer than 20 real AI requests were observed in the current 7-day window.");

 return {
  cohort,cohort_decision:cohortDecision,confidence,reasons,
  pricing:{
   FREE:{current_units:freeUnits,recommendation:freeRecommendation,projected_monthly_units_per_active:round(projectedUnitsPerActive),projected_utilization_percent:round(freeUtilization),projected_monthly_requests_per_active:round(projectedRequestsPerActive)},
   PLUS:{current_units:plusUnits,current_price_inr:499,recommendation:plusRecommendation,conservative_ai_margin_percent:round(plusMargin)},
   PRO:{current_units:proUnits,current_price_inr:1499,recommendation:proRecommendation,conservative_ai_margin_percent:round(proMargin),extreme_stress_loss:Boolean(econ.risk?.pro_worst_case_ai_variable_loss)}
  },
  pilot_metrics:m,
  economics_status:econ.risk?.status||"UNKNOWN",
  generated_at:new Date().toISOString()
 };
}

export async function savePilotDecision(cohort="PILOT_1"){
 const d=await computePilotDecision(cohort);
 const row=(await db.query(`INSERT INTO pilot_pricing_decisions(
  decision_date,cohort,cohort_decision,free_recommendation,plus_recommendation,pro_recommendation,confidence,metrics,reasons
 ) VALUES(CURRENT_DATE,$1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)
 RETURNING id,decision_date,created_at`,[
  cohort,d.cohort_decision,d.pricing.FREE.recommendation,d.pricing.PLUS.recommendation,d.pricing.PRO.recommendation,d.confidence,
  JSON.stringify({pricing:d.pricing,pilot_metrics:d.pilot_metrics,economics_status:d.economics_status}),JSON.stringify(d.reasons)
 ])).rows[0];
 return {...d,snapshot_id:row.id,decision_date:row.decision_date};
}