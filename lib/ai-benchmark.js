import { db } from "hatchable";
import { generateText } from "./ai-router.js";
import { routeProfile,budgetMessages } from "./ai-optimization.js";

function usageNums(u={}){
 return {
  input:Number(u.input??u.prompt_tokens??u.input_tokens??0)||0,
  output:Number(u.output??u.completion_tokens??u.output_tokens??0)||0
 };
}
function quality(text,checks=[]){
 const t=String(text||"").toLowerCase();
 return Boolean(t.trim())&&checks.every(x=>t.includes(String(x).toLowerCase()));
}
function safeMeta(x){try{return JSON.parse(JSON.stringify(x??{}))}catch{return{}}}

const scenarios=[
 {
  key:"simple_qa",name:"Simple Q&A",expectedLane:"CHEAP",
  system:"Answer concisely and accurately.",
  messages:[{role:"user",content:"In two bullets, explain what dependency injection does in ASP.NET Core."}],
  checks:["dependency"],maxSteps:1
 },
 {
  key:"standard_reasoning",name:"Standard reasoning",expectedLane:"STANDARD",
  system:"Give a practical recommendation with concise reasoning.",
  messages:[{role:"user",content:"I have five tasks due this week, two meetings tomorrow, and only three focused hours today. Explain how I should prioritize the work and give a short plan."}],
  checks:["prior"],maxSteps:1
 },
 {
  key:"long_context",name:"40-turn context continuation",expectedLane:"STANDARD",
  system:"Use the recent context and preserve the stated project decision.",
  makeMessages(){
   const out=[];
   for(let i=1;i<=20;i++){
    out.push({role:"user",content:"Project discussion turn "+i+": we are designing an internal inventory application. Keep responses concise."});
    out.push({role:"assistant",content:"Acknowledged project discussion turn "+i+"."});
   }
   out.push({role:"user",content:"Our final decision is to use PostgreSQL and ASP.NET Core. Summarize the current technical decision in one sentence."});
   return out;
  },
  checks:["postgresql","asp.net"],maxSteps:1
 },
 {
  key:"coding",name:"Coding/debugging",expectedLane:"DEEP",
  system:"Act as a senior .NET engineer. Be precise and compact.",
  messages:[{role:"user",content:"Analyze this complex ASP.NET Core concurrency bug and propose a robust fix step-by-step. A scoped service caches a mutable List<Order> and multiple async controller requests update it concurrently, causing collection-modified exceptions and stale state. Explain the architecture problem, the correct service lifetime/data ownership, and a safe implementation approach."}],
  checks:["scoped","concurr"],maxSteps:1
 },
 {
  key:"document_qa",name:"Document-style grounded Q&A",expectedLane:"STANDARD",
  system:"Answer only from the supplied source excerpts and cite [Source 1] or [Source 2].",
  messages:[{role:"user",content:"Question: What is the cancellation rule?\n\n[Source 1] Subscription policy: a customer may cancel at any time, but access remains active until the end of the current paid billing period.\n\n[Source 2] Refund policy: completed billing periods are normally non-refundable."}],
  checks:["end","billing"],maxSteps:1
 },
 {
  key:"tool_read",name:"Safe read-only tool flow",expectedLane:"STANDARD",
  system:"Use the provided status_check tool once, then report its status in one sentence.",
  messages:[{role:"user",content:"Check the workspace service status using the available tool and tell me whether it is healthy."}],
  checks:["healthy"],maxSteps:2,
  tools:{
   status_check:{
    description:"Return a safe synthetic workspace health status for benchmark validation.",
    inputSchema:{type:"object",properties:{}},
    execute:async()=>({status:"healthy",source:"benchmark"})
   }
  }
 }
];

export async function runAiBenchmarkSuite(userId){
 const suiteId=crypto.randomUUID(),results=[];
 for(const s of scenarios){
  const messages=s.makeMessages?s.makeMessages():s.messages;
  const last=[...messages].reverse().find(x=>x.role==="user")?.content||"";
  const profile=routeProfile({purpose:"benchmark:"+s.key,message:last,hasTools:Boolean(s.tools),responseStyle:"concise"});
  const budget=budgetMessages(messages,profile.maxRecentMessages,profile.maxMessageChars);
  const started=Date.now();
  let result=null,error=null;
  try{
   result=await generateText({
    model:"google.gemini",
    purpose:"benchmark:"+s.key,
    userId,
    system:s.system,
    messages,
    tools:s.tools,
    maxSteps:s.maxSteps||1,
    responseStyle:"concise",
    cacheTtlSeconds:0,
    suppressOptimizationTelemetry:true
   });
  }catch(e){error=e}
  const latency=Date.now()-started,u=usageNums(result?.usage);
  const pass=!error&&quality(result?.text,s.checks);
  const row=(await db.query(`INSERT INTO ai_benchmark_runs(
    suite_id,scenario_key,scenario_name,expected_lane,actual_lane,provider,model,success,quality_pass,
    latency_ms,input_tokens,output_tokens,estimated_trimmed_messages,metadata,created_by
   ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15) RETURNING id,created_at`,[
    suiteId,s.key,s.name,s.expectedLane,profile.lane,result?.provider||null,result?.model||null,!error,pass,
    latency,u.input,u.output,budget.trimmed,
    JSON.stringify(safeMeta({error:error?String(error.message||error).slice(0,500):null,tool_steps:result?.steps?.length||0,finish_reason:result?.finishReason||null})),
    userId
   ])).rows[0];
  results.push({
   id:row?.id,scenario_key:s.key,scenario_name:s.name,expected_lane:s.expectedLane,actual_lane:profile.lane,
   provider:result?.provider||null,model:result?.model||null,success:!error,quality_pass:pass,latency_ms:latency,
   input_tokens:u.input,output_tokens:u.output,trimmed_messages:budget.trimmed,error:error?String(error.message||error).slice(0,300):null
  });
 }
 const successful=results.filter(x=>x.success),qualityPassed=results.filter(x=>x.quality_pass);
 return {
  suite_id:suiteId,
  created_at:new Date().toISOString(),
  summary:{
   scenarios:results.length,
   successful:successful.length,
   quality_passed:qualityPassed.length,
   avg_latency_ms:successful.length?Math.round(successful.reduce((a,x)=>a+x.latency_ms,0)/successful.length):0,
   p50_target_pass:successful.filter(x=>x.latency_ms<=2000).length,
   total_input_tokens:successful.reduce((a,x)=>a+x.input_tokens,0),
   total_output_tokens:successful.reduce((a,x)=>a+x.output_tokens,0),
   total_trimmed_messages:results.reduce((a,x)=>a+x.trimmed_messages,0)
  },
  results
 };
}

export async function benchmarkHistory(limit=10){
 const suites=(await db.query(`
  SELECT suite_id,min(created_at) created_at,count(*)::int scenarios,
    count(*) FILTER (WHERE success)::int successful,
    count(*) FILTER (WHERE quality_pass)::int quality_passed,
    round(avg(latency_ms))::int avg_latency_ms,
    COALESCE(sum(input_tokens),0)::bigint input_tokens,
    COALESCE(sum(output_tokens),0)::bigint output_tokens,
    COALESCE(sum(estimated_trimmed_messages),0)::bigint trimmed_messages
  FROM ai_benchmark_runs GROUP BY suite_id ORDER BY min(created_at) DESC LIMIT $1
 `,[Math.max(1,Math.min(30,Number(limit)||10))])).rows;
 const latest=suites[0]?.suite_id?(await db.query("SELECT scenario_key,scenario_name,expected_lane,actual_lane,provider,model,success,quality_pass,latency_ms,input_tokens,output_tokens,estimated_trimmed_messages,metadata,created_at FROM ai_benchmark_runs WHERE suite_id=$1 ORDER BY created_at",[suites[0].suite_id])).rows:[];
 return {suites,latest};
}