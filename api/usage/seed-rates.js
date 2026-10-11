import { db } from "hatchable";
export const access="admin";
export const methods=["POST"];

async function ensureRate(provider,model,inputRate,outputRate,effectiveFrom,effectiveTo=null){
 const existing=(await db.query(
  "SELECT id FROM usage_rate_cards WHERE provider=$1 AND meter_key='ai_generation' AND model=$2 AND effective_from=$3 LIMIT 1",
  [provider,model,effectiveFrom]
 )).rows[0];
 if(existing)return existing.id;
 const row=(await db.query(
  "INSERT INTO usage_rate_cards(provider,meter_key,model,input_microusd_per_million,output_microusd_per_million,effective_from,effective_to,active) VALUES($1,'ai_generation',$2,$3,$4,$5,$6,true) RETURNING id",
  [provider,model,inputRate,outputRate,effectiveFrom,effectiveTo]
 )).rows[0];
 return row.id;
}

export default async function(req,res){
 const rates=[
  {provider:"google",model:"gemini-3.5-flash-lite",input:300000,output:2500000,from:"2026-07-21T00:00:00Z",to:null},
  {provider:"google",model:"gemini-3.8-flash",input:750000,output:3750000,from:"2026-10-01T00:00:00Z",to:"2027-01-01T00:00:00Z"},
  {provider:"google",model:"gemini-3.8-flash",input:1500000,output:7500000,from:"2027-01-01T00:00:00Z",to:null},
  {provider:"groq",model:"openai/gpt-oss-20b",input:75000,output:300000,from:"2026-10-11T00:00:00Z",to:null}
 ];
 const ids=[];
 for(const r of rates)ids.push(await ensureRate(r.provider,r.model,r.input,r.output,new Date(r.from),r.to?new Date(r.to):null));

 const backfills=[];
 backfills.push((await db.query(
  "UPDATE usage_events SET estimated_cost_microusd=((COALESCE(input_tokens,0)::bigint*300000)/1000000)+((COALESCE(output_tokens,0)::bigint*2500000)/1000000),priced=true WHERE event_type='ai_generation' AND priced=false AND provider='google' AND model='gemini-3.5-flash-lite' AND occurred_at>='2026-07-21T00:00:00Z' RETURNING id"
 )).rowCount||0);
 backfills.push((await db.query(
  "UPDATE usage_events SET estimated_cost_microusd=((COALESCE(input_tokens,0)::bigint*750000)/1000000)+((COALESCE(output_tokens,0)::bigint*3750000)/1000000),priced=true WHERE event_type='ai_generation' AND priced=false AND provider='google' AND model='gemini-3.8-flash' AND occurred_at>='2026-10-01T00:00:00Z' AND occurred_at<'2027-01-01T00:00:00Z' RETURNING id"
 )).rowCount||0);
 backfills.push((await db.query(
  "UPDATE usage_events SET estimated_cost_microusd=((COALESCE(input_tokens,0)::bigint*75000)/1000000)+((COALESCE(output_tokens,0)::bigint*300000)/1000000),priced=true WHERE event_type='ai_generation' AND priced=false AND provider='groq' AND model='openai/gpt-oss-20b' AND occurred_at>='2026-10-11T00:00:00Z' RETURNING id"
 )).rowCount||0);

 res.json({ok:true,rate_cards:ids.length,backfilled_events:backfills.reduce((a,b)=>a+b,0)});
}