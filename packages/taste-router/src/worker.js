// Cloudflare Worker entry: static UI (assets binding) + streaming agent API.
// Bindings: QLOO_API_KEY (secret), AI (Workers AI), CACHE (KV, optional), ASSETS (static files).
import { createQloo } from './qloo.js';
import { createLLM } from './llm.js';
import { runScout } from './agent.js';
import STATIC from './static.gen.js';

const kvStore = kv => kv && {
  async get(k) { return kv.get(k, 'json'); },
  async put(k, v) { await kv.put(k, JSON.stringify(v), { expirationTtl: 60 * 60 * 24 * 21 }); },
};

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });

async function hashKey(obj) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(JSON.stringify(obj)));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST', 'access-control-allow-headers': 'content-type' } });

    if (url.pathname === '/api/health') return json({ ok: true, qloo: !!env.QLOO_API_KEY, llm: !!env.AI });

    if (url.pathname === '/api/scout' && request.method === 'POST') {
      const input = await request.json().catch(() => ({}));
      if (!input.brief && !(input.city && input.seeds?.length)) return json({ error: 'Send {brief} or {city, seeds[]}' }, 400);
      if ((input.brief || '').length > 1200) return json({ error: 'Brief too long (max 1200 chars).' }, 400);
      const store = kvStore(env.CACHE);
      const runKey = `run:v4:${await hashKey({ b: (input.brief || '').trim().toLowerCase(), c: input.city, s: input.seeds })}`;
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const enc = new TextEncoder();
      const send = ev => writer.write(enc.encode(JSON.stringify(ev) + '\n')).catch(() => {});
      ctx.waitUntil((async () => {
        try {
          const cached = store && !input.fresh ? await store.get(runKey) : null;
          if (cached) {
            for (const ev of cached.events) send({ ...ev, replay: true });
            send({ type: 'note', text: 'Served from cache to save Qloo quota (same brief was scouted recently).' });
            send({ type: 'result', result: cached.result });
          } else {
            const events = [];
            const qloo = createQloo({ apiKey: env.QLOO_API_KEY, baseUrl: env.QLOO_API_URL || undefined, store, onCall: c => send({ type: 'qloo_call', path: c.path, ms: c.ms, ok: c.ok, cached: !!c.cached }) });
            const result = await runScout(input, { qloo, llm: createLLM(env), store, emit: ev => { if (ev.type !== 'result') { events.push(ev); send(ev); } } });
            send({ type: 'result', result });
            if (store) await store.put(runKey, { events: events.filter(e => e.type === 'step' && e.status !== 'start'), result });
          }
        } catch (e) {
          send({ type: 'error', error: String(e.message || e) });
        } finally { await writer.close().catch(() => {}); }
      })());
      return new Response(readable, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' } });
    }

    const file = STATIC[url.pathname];
    if (file) return new Response(file[1], { headers: { 'content-type': file[0], 'cache-control': 'public, max-age=300' } });
    return new Response('Not found', { status: 404 });
  },
};
