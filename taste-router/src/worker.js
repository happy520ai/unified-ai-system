// Cloudflare Worker entry: static UI (inlined) + streaming agent API + shareable reports + follow-up chat.
// Bindings: QLOO_API_KEY (secret), AI (Workers AI), CACHE (KV, optional).
import { createQloo } from './qloo.js';
import { createLLM } from './llm.js';
import { runScout } from './agent.js';
import { runTour } from './tour.js';
import { askReport } from './ask.js';
import STATIC from './static.gen.js';

const DAY = 60 * 60 * 24;
const kvStore = (kv, ttl = 21 * DAY) => kv && {
  async get(k) { return kv.get(k, 'json'); },
  async put(k, v) { await kv.put(k, JSON.stringify(v), { expirationTtl: ttl }); },
};
const REPORT_TTL = 120 * DAY; // reports outlive judging (Nov 2-16) so shared links keep working

const CORS = { 'access-control-allow-origin': '*' };
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...CORS, ...extra } });

async function hashKey(obj) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(JSON.stringify(obj)));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Run an agent (or replay it from the run cache) as an NDJSON stream; every finished run gets a permalink id. */
function streamRun({ env, ctx, input, runKey, reportId, kind, runner }) {
  const store = kvStore(env.CACHE);
  const runs = kvStore(env.CACHE, 45 * DAY); // finished runs outlive the judging window
  const reports = kvStore(env.CACHE, REPORT_TTL);
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  const send = ev => writer.write(enc.encode(JSON.stringify(ev) + '\n')).catch(() => {});
  const saveReport = async (result, events, calls) => {
    if (!reports) return;
    const have = await reports.get(`report:${reportId}`).catch(() => null);
    if (!have || input.fresh) await reports.put(`report:${reportId}`, { id: reportId, kind, input, result, events, calls, created: new Date().toISOString() });
    send({ type: 'report', id: reportId });
  };
  ctx.waitUntil((async () => {
    try {
      const cached = runs && !input.fresh ? await runs.get(runKey) : null;
      if (cached) {
        for (const ev of cached.events) send({ ...ev, replay: true });
        send({ type: 'note', text: `Replayed from cache to save Qloo quota${cached.calls ? ` (the original run made ${cached.calls} Qloo calls)` : ''}.` });
        send({ type: 'cache', calls: cached.calls || 0 });
        send({ type: 'result', result: cached.result });
        await saveReport(cached.result, cached.events, cached.calls);
      } else {
        const events = []; let calls = 0;
        const qloo = createQloo({ apiKey: env.QLOO_API_KEY, baseUrl: env.QLOO_API_URL || undefined, store, onCall: c => { calls++; send({ type: 'qloo_call', path: c.path, ms: c.ms, ok: c.ok, cached: !!c.cached }); } });
        const result = await runner(input, { qloo, llm: createLLM(env), store, storyModel: env.STORY_MODEL, emit: ev => { if (ev.type !== 'result') { events.push(ev); send(ev); } } });
        send({ type: 'result', result });
        const kept = events.filter(e => e.type === 'step' && e.status !== 'start');
        if (runs) await runs.put(runKey, { events: kept, result, calls });
        await saveReport(result, kept, calls);
      }
    } catch (e) {
      send({ type: 'error', error: String(e.message || e) });
    } finally { await writer.close().catch(() => {}); }
  })());
  return new Response(readable, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', ...CORS } });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: { ...CORS, 'access-control-allow-methods': 'GET,POST', 'access-control-allow-headers': 'content-type' } });

    if (url.pathname === '/api/health') return json({ ok: true, qloo: !!env.QLOO_API_KEY, llm: !!env.AI, reports: !!env.CACHE });

    if (url.pathname === '/api/scout' && request.method === 'POST') {
      const input = await request.json().catch(() => ({}));
      if (!input.brief && !(input.city && input.seeds?.length)) return json({ error: 'Send {brief} or {city, seeds[]}' }, 400);
      if ((input.brief || '').length > 1200) return json({ error: 'Brief too long (max 1200 chars).' }, 400);
      const h = await hashKey({ b: (input.brief || '').trim().toLowerCase(), c: input.city, s: input.seeds });
      return streamRun({ env, ctx, input, runKey: `run:v15:${h}`, reportId: `s${(await hashKey(`run:v15:${h}`)).slice(0, 11)}`, kind: 'scout', runner: runScout });
    }

    if (url.pathname === '/api/tour' && request.method === 'POST') {
      const input = await request.json().catch(() => ({}));
      if (!input.artist && !input.seeds?.length) return json({ error: 'Send {artist, cities?[], stops?}' }, 400);
      if (String(input.artist || '').length > 120) return json({ error: 'Artist name too long.' }, 400);
      const h = await hashKey({ a: String(input.artist || '').trim().toLowerCase(), s: input.seeds, c: input.cities, n: input.stops });
      return streamRun({ env, ctx, input, runKey: `tour:v5:${h}`, reportId: `t${(await hashKey(`tour:v5:${h}`)).slice(0, 11)}`, kind: 'tour', runner: runTour });
    }

    const rep = /^\/api\/report\/([st][0-9a-f]{11})$/.exec(url.pathname);
    if (rep && request.method === 'GET') {
      const report = env.CACHE ? await env.CACHE.get(`report:${rep[1]}`, 'json') : null;
      return report ? json(report, 200, { 'cache-control': 'public, max-age=300' }) : json({ error: 'Report not found or expired.' }, 404);
    }

    if (url.pathname === '/api/ask' && request.method === 'POST') {
      const { id, question, history } = await request.json().catch(() => ({}));
      if (!/^[st][0-9a-f]{11}$/.test(id || '')) return json({ error: 'Send {id, question}.' }, 400);
      const q = String(question || '').trim();
      if (q.length < 3 || q.length > 300) return json({ error: 'Ask a question of 3-300 characters.' }, 400);
      const report = env.CACHE ? await env.CACHE.get(`report:${id}`, 'json') : null;
      if (!report) return json({ error: 'Report not found or expired.' }, 404);
      const hist = Array.isArray(history) ? history.slice(-3) : [];
      const store = kvStore(env.CACHE);
      const askKey = `ask:v2:${id}:${await hashKey({ q: q.toLowerCase(), h: hist.map(x => x.q) })}`;
      const hit = store && await store.get(askKey).catch(() => null);
      if (hit) return json({ ...hit, cached: true });
      try {
        const qloo = env.QLOO_API_KEY ? createQloo({ apiKey: env.QLOO_API_KEY, baseUrl: env.QLOO_API_URL || undefined, store }) : null;
        const out = await askReport({ report, question: q, history: hist }, { llm: createLLM(env), qloo, model: env.STORY_MODEL });
        if (store && out.answer) await store.put(askKey, out);
        return json(out);
      } catch (e) { return json({ error: String(e.message || e) }, 500); }
    }

    if (/^\/r\/[st][0-9a-f]{11}$/.test(url.pathname)) {
      const [type, body] = STATIC['/'];
      return new Response(body, { headers: { 'content-type': type, 'cache-control': 'public, max-age=300' } });
    }

    const file = STATIC[url.pathname];
    if (file) return new Response(file[1], { headers: { 'content-type': file[0], 'cache-control': 'public, max-age=300' } });
    return new Response('Not found', { status: 404 });
  },
};
