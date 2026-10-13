// LLM adapters. The agent only needs chat(messages) -> string. Two backends:
//  - Cloudflare Workers AI binding (free tier, no key) when running as a Worker
//  - any OpenAI-compatible endpoint (OpenRouter, Groq, Ollama, ...) via LLM_BASE_URL / LLM_API_KEY / LLM_MODEL
export function createLLM(env = {}, { fetchImpl = fetch } = {}) {
  if (env.AI && typeof env.AI.run === 'function') {
    const model = env.WORKERS_AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
    return {
      name: `workers-ai:${model.split('/').pop()}`,
      async chat(messages, { maxTokens = 1200, temperature = 0.3 } = {}) {
        const r = await env.AI.run(model, { messages, max_tokens: maxTokens, temperature });
        return typeof r?.response === 'string' ? r.response : JSON.stringify(r?.response ?? r);
      },
    };
  }
  if (env.LLM_BASE_URL) {
    const model = env.LLM_MODEL || 'google/gemma-4-31b-it:free';
    return {
      name: `openai-compatible:${model}`,
      async chat(messages, { maxTokens = 1200, temperature = 0.3 } = {}) {
        const headers = { 'content-type': 'application/json' };
        if (env.LLM_API_KEY) headers.authorization = `Bearer ${env.LLM_API_KEY}`;
        const res = await fetchImpl(`${env.LLM_BASE_URL.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers, body: JSON.stringify({ model, messages, max_tokens: Math.round(maxTokens * (+env.LLM_TOKEN_FACTOR || 1)), temperature, ...(env.LLM_REASONING_OFF ? { reasoning: { enabled: false } } : {}) }) });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error?.message || `LLM ${res.status}`);
        return body.choices?.[0]?.message?.content ?? '';
      },
    };
  }
  return null;
}

/** Pull the first JSON object out of a model reply (tolerates ```json fences and chatter). */
export function parseJSON(text) {
  if (!text) return null;
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const src = fenced ? fenced[1] : text;
  const start = src.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}' && --depth === 0) {
      try { return JSON.parse(src.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}
