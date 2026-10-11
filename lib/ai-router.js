import { ai, config, db } from "hatchable";
import { recordAiUsage } from "./usage-meter.js";
import { routeProfile,budgetMessages,makeCacheKey,readAiCache,writeAiCache,bumpOptimization } from "./ai-optimization.js";

const PRIMARY_MODEL = "gemini-3.8-flash";
const STANDARD_MODEL = PRIMARY_MODEL;
const GROQ_MODEL = "openai/gpt-oss-20b";
const MAX_GROQ_STEPS = 10;

function errorText(err) {
  return String(err?.message || err?.error?.message || err || "").toLowerCase();
}

function statusOf(err) {
  return Number(err?.status || err?.statusCode || err?.response?.status || 0);
}

function shouldFallback(err) {
  const status = statusOf(err);
  const msg = errorText(err);
  if (err?.code === "SetupRequired") return true;
  if (status === 408 || status === 409 || status === 429 || status >= 500) return true;
  return /timeout|timed out|temporar|rate.?limit|quota|unavailable|network|gateway|setup|required/.test(msg);
}

function routedModel(requestedModel, profile) {
  if (!requestedModel || requestedModel === "google.gemini" || requestedModel === "gemini-3-flash-preview") return profile?.model||PRIMARY_MODEL;
  return requestedModel;
}

function normalizeMessages(messages, system) {
  const out = [];
  if (system) out.push({ role: "system", content: system });
  for (const m of messages || []) {
    if (!m || !m.role) continue;
    if (m.role === "tool") continue;
    out.push({
      role: m.role === "assistant" ? "assistant" : "user",
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "")
    });
  }
  return out;
}

function groqTools(tools) {
  if (!tools) return [];
  return Object.entries(tools).map(([name, tool]) => ({
    type: "function",
    function: {
      name,
      description: tool.description || "",
      parameters: tool.inputSchema || { type: "object", properties: {} }
    }
  }));
}

function usageNumbers(usage) {
  const input = Number(usage?.input ?? usage?.prompt_tokens ?? usage?.input_tokens ?? 0) || 0;
  const output = Number(usage?.output ?? usage?.completion_tokens ?? usage?.output_tokens ?? 0) || 0;
  const total = Number(usage?.total_tokens ?? (input + output)) || (input + output);
  return { input, output, total };
}

async function startRun({userId,purpose,requestedModel}) {
  if (!userId) return null;
  try {
    const r=await db.query("INSERT INTO ai_runs(user_id,purpose,requested_model,status) VALUES($1,$2,$3,'STARTED') RETURNING id",[userId,purpose||null,requestedModel||null]);
    return r.rows[0]?.id||null;
  } catch (_) { return null; }
}

async function finishRun(id,{provider,model,status='COMPLETED',fallbackUsed=false,usage,latencyMs,error}) {
  if (!id) return;
  const u=usageNumbers(usage);
  try {
    await db.query("UPDATE ai_runs SET provider=$2,model=$3,status=$4,fallback_used=$5,input_tokens=$6,output_tokens=$7,total_tokens=$8,latency_ms=$9,error_code=$10,error_message=$11,completed_at=now() WHERE id=$1",[
      id,provider||null,model||null,status,Boolean(fallbackUsed),u.input||null,u.output||null,u.total||null,latencyMs||null,error?.code||null,error?String(error?.message||error).slice(0,1000):null
    ]);
  } catch (_) {}
}

async function callGroq({ system, messages, tools, maxSteps = MAX_GROQ_STEPS, maxCompletionTokens = 1600 }) {
  const key = await config.get("GROQ_API_KEY");
  if (!key) {
    const e = new Error("GROQ_API_KEY is not configured.");
    e.code = "PROVIDER_UNAVAILABLE";
    throw e;
  }

  const chatMessages = normalizeMessages(messages, system);
  const schemas = groqTools(tools);
  const steps = [];
  let lastUsage = null;

  for (let step = 0; step < Math.max(1, maxSteps); step++) {
    const body = {
      model: GROQ_MODEL,
      messages: chatMessages,
      temperature: 0.2,
      max_completion_tokens: Math.max(256,Math.min(2400,Number(maxCompletionTokens)||1600))
    };
    if (schemas.length) {
      body.tools = schemas;
      body.tool_choice = "auto";
      body.parallel_tool_calls = true;
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      const e = new Error(data?.error?.message || ("Groq request failed (" + response.status + ")."));
      e.status = response.status;
      throw e;
    }

    const choice = data?.choices?.[0];
    const message = choice?.message || {};
    lastUsage = data?.usage || null;
    const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];

    if (!toolCalls.length) return { text:message.content||"",steps,usage:lastUsage,model:GROQ_MODEL,provider:"groq",finishReason:choice?.finish_reason||"stop" };

    chatMessages.push(message);
    const stepTools = [];
    for (const call of toolCalls) {
      const name = call?.function?.name;
      const tool = tools?.[name];
      let args = {};
      try { args = JSON.parse(call?.function?.arguments || "{}"); } catch (_) {}
      let result;
      if (!tool?.execute) result = { error: "Unknown or unavailable tool: " + name };
      else { try { result = await tool.execute(args); } catch (e) { result = { error: String(e?.message || e) }; } }
      chatMessages.push({role:"tool",tool_call_id:call.id,name,content:typeof result==="string"?result:JSON.stringify(result??{})});
      stepTools.push({ id:call.id,name,input:args,result });
    }
    steps.push({toolCalls:stepTools});
  }

  return { text:"I reached the maximum number of tool steps before completing the request.",steps,usage:lastUsage,model:GROQ_MODEL,provider:"groq",finishReason:"length" };
}

export async function generateText({ model = "google.gemini", system = "", prompt, messages = [], tools, maxSteps = 1, purpose, userId, responseStyle="concise", cacheTtlSeconds=0 }) {
  const requestedModel=model;
  const rawMessages = messages?.length ? messages : (prompt != null ? [{ role: "user", content: String(prompt) }] : []);
  const lastUser=[...rawMessages].reverse().find(x=>x?.role==="user")?.content||String(prompt||"");
  const hasTools=Boolean(tools&&Object.keys(tools).length);
  const profile=routeProfile({purpose,message:lastUser,hasTools,responseStyle});
  const primaryModel=routedModel(model,profile);
  const budget=budgetMessages(rawMessages,profile.maxRecentMessages,profile.maxMessageChars);
  const inputMessages=budget.messages;
  const budgetSystem=(system?system+"\n":"")+"Response budget: "+profile.outputHint+". Avoid unnecessary repetition.";
  let cacheKey=null;
  if(userId&&cacheTtlSeconds>0&&!hasTools){
    cacheKey=await makeCacheKey({purpose,model:primaryModel,system:budgetSystem,messages:inputMessages});
    const cached=await readAiCache(userId,cacheKey);
    if(cached)return {...cached,cached:true};
  }
  await bumpOptimization(userId,{messages_trimmed:budget.trimmed,[profile.lane==="CHEAP"?"cheap_model_runs":"standard_model_runs"]:1});
  const runId=await startRun({userId,purpose,requestedModel});
  const started=Date.now();

  let geminiError = null;
  try {
    const result = await ai.generateText({ model:primaryModel, system:budgetSystem, messages:inputMessages, tools:hasTools?tools:undefined, maxSteps:Math.max(1,maxSteps), purpose, userId });
    const out={...result,provider:"google",model:result.model||primaryModel,fallbackUsed:false};
    await finishRun(runId,{provider:"google",model:out.model,usage:out.usage,latencyMs:Date.now()-started});
    await recordAiUsage({userId,runId,provider:"google",model:out.model,purpose,usage:out.usage,fallbackUsed:false,status:"COMPLETED",optimizationLane:profile.lane});
    if(cacheKey)await writeAiCache({userId,cacheKey,purpose,model:out.model,response:out,ttlSeconds:cacheTtlSeconds});
    return out;
  } catch (err) {
    geminiError = err;
    const cheapUnavailable=profile.lane==="CHEAP"&&(statusOf(err)===404||/model|not found|unsupported|invalid/.test(errorText(err)));
    if(cheapUnavailable){
      try{
        const retry=await ai.generateText({model:STANDARD_MODEL,system:budgetSystem,messages:inputMessages,tools:hasTools?tools:undefined,maxSteps:Math.max(1,maxSteps),purpose,userId});
        const out={...retry,provider:"google",model:retry.model||STANDARD_MODEL,fallbackUsed:true};
        await finishRun(runId,{provider:"google",model:out.model,usage:out.usage,latencyMs:Date.now()-started,fallbackUsed:true});
        await recordAiUsage({userId,runId,provider:"google",model:out.model,purpose,usage:out.usage,fallbackUsed:true,status:"COMPLETED",optimizationLane:"STANDARD_FALLBACK"});
        if(cacheKey)await writeAiCache({userId,cacheKey,purpose,model:out.model,response:out,ttlSeconds:cacheTtlSeconds});
        return out;
      }catch(retryError){geminiError=retryError}
    }
    if (!shouldFallback(geminiError)) {
      await finishRun(runId,{provider:"google",model:primaryModel,status:"ERROR",latencyMs:Date.now()-started,error:geminiError});
      throw geminiError;
    }
  }

  try {
    const groqBudget=profile.lane==="CHEAP"?800:profile.outputHint.includes("1400")?2400:1600;
    const result=await callGroq({system:budgetSystem,messages:inputMessages,tools,maxSteps,maxCompletionTokens:groqBudget});
    const out={...result,fallbackUsed:true};
    await finishRun(runId,{provider:"groq",model:out.model,usage:out.usage,latencyMs:Date.now()-started,fallbackUsed:true});
    await recordAiUsage({userId,runId,provider:"groq",model:out.model,purpose,usage:out.usage,fallbackUsed:true,status:"COMPLETED",optimizationLane:profile.lane});
    if(cacheKey)await writeAiCache({userId,cacheKey,purpose,model:out.model,response:out,ttlSeconds:cacheTtlSeconds});
    return out;
  } catch (groqError) {
    const e = new Error("No AI provider is currently available. Configure a Gemini or Groq key and try again.");
    e.code = "AI_PROVIDERS_UNAVAILABLE";
    e.providers = { google:errorText(geminiError).slice(0,240),groq:errorText(groqError).slice(0,240) };
    await finishRun(runId,{provider:"none",model:primaryModel,status:"ERROR",latencyMs:Date.now()-started,fallbackUsed:true,error:e});
    throw e;
  }
}