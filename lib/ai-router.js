import { ai, config } from "hatchable";

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

async function callGroq({ system, messages, tools, maxSteps = MAX_GROQ_STEPS }) {
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
      max_completion_tokens: 4096
    };
    if (schemas.length) {
      body.tools = schemas;
      body.tool_choice = "auto";
      body.parallel_tool_calls = true;
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json"
      },
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

    if (!toolCalls.length) {
      return {
        text: message.content || "",
        steps,
        usage: lastUsage,
        model: GROQ_MODEL,
        provider: "groq",
        finishReason: choice?.finish_reason || "stop"
      };
    }

    chatMessages.push(message);
    const stepTools = [];

    for (const call of toolCalls) {
      const name = call?.function?.name;
      const tool = tools?.[name];
      let args = {};
      try { args = JSON.parse(call?.function?.arguments || "{}"); } catch (_) {}

      let result;
      if (!tool?.execute) {
        result = { error: "Unknown or unavailable tool: " + name };
      } else {
        try {
          result = await tool.execute(args);
        } catch (e) {
          result = { error: String(e?.message || e) };
        }
      }

      const serialized = typeof result === "string" ? result : JSON.stringify(result ?? {});
      chatMessages.push({
        role: "tool",
        tool_call_id: call.id,
        name,
        content: serialized
      });
      stepTools.push({ id: call.id, name, input: args, result });
    }

    steps.push({ toolCalls: stepTools });
  }

  return {
    text: "I reached the maximum number of tool steps before completing the request.",
    steps,
    usage: lastUsage,
    model: GROQ_MODEL,
    provider: "groq",
    finishReason: "length"
  };
}

export async function generateText({
  model = "google.gemini",
  system = "",
  prompt,
  messages = [],
  tools,
  maxSteps = 1,
  purpose,
  userId
}) {
  const inputMessages = messages?.length ? messages : (prompt != null ? [{ role: "user", content: String(prompt) }] : []);

  let geminiError = null;
  try {
    const result = await ai.generateText({
      model,
      system,
      messages: inputMessages,
      tools,
      maxSteps: Math.max(1, maxSteps),
      purpose,
      userId
    });
    return {
      ...result,
      provider: "google",
      model: result.model || model
    };
  } catch (err) {
    geminiError = err;
    if (!shouldFallback(err)) throw err;
  }

  try {
    return await callGroq({
      system,
      messages: inputMessages,
      tools,
      maxSteps
    });
  } catch (groqError) {
    const e = new Error(
      "No AI provider is currently available. Configure a Gemini or Groq key and try again."
    );
    e.code = "AI_PROVIDERS_UNAVAILABLE";
    e.providers = {
      google: errorText(geminiError).slice(0, 240),
      groq: errorText(groqError).slice(0, 240)
    };
    throw e;
  }
}