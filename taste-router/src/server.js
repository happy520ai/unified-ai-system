#!/usr/bin/env node
// Local / self-hosted server: same API and UI as the Cloudflare Worker, on Node 20+ with zero dependencies.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createQloo } from './qloo.js';
import { createLLM } from './llm.js';
import { runScout } from './agent.js';
import { runTour } from './tour.js';
import { askReport } from './ask.js';
import { fileStore } from './fileStore.js';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'public');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const store = fileStore(process.env.CACHE_DIR || '.cache');
const sha = o => createHash('sha1').update(JSON.stringify(o)).digest('hex');
const makeQloo = onCall => createQloo({ apiKey: process.env.QLOO_API_KEY, baseUrl: process.env.QLOO_API_URL || undefined, store, onCall });
const readBody = async req => { let b = ''; for await (const c of req) b += c; try { return JSON.parse(b || '{}'); } catch { return {}; } };
const sendJSON = (res, status, data) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };

async function stream(req, res, kind) {
  const input = await readBody(req);
  const id = kind === 'scout' ? `s${sha({ b: (input.brief || '').trim().toLowerCase(), c: input.city, s: input.seeds }).slice(0, 11)}` : `t${sha({ a: String(input.artist || '').trim().toLowerCase(), s: input.seeds, c: input.cities, n: input.stops }).slice(0, 11)}`;
  res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8' });
  const send = ev => res.write(JSON.stringify(ev) + '\n');
  const events = []; let calls = 0;
  try {
    const qloo = makeQloo(c => { calls++; send({ type: 'qloo_call', path: c.path, ms: c.ms, ok: c.ok, cached: !!c.cached }); });
    const emit = ev => { if (ev.type === 'step' && ev.status !== 'start') events.push(ev); send(ev); };
    const result = await (kind === 'scout' ? runScout : runTour)(input, { qloo, llm: createLLM(process.env), store, emit });
    await store.put(`report:${id}`, { id, kind, input, result, events, calls, created: new Date().toISOString() });
    send({ type: 'report', id });
  } catch (e) { send({ type: 'error', error: String(e.message || e) }); }
  res.end();
}

createServer(async (req, res) => {
  const path0 = req.url.split('?')[0];
  if (path0 === '/api/scout' && req.method === 'POST') return stream(req, res, 'scout');
  if (path0 === '/api/tour' && req.method === 'POST') return stream(req, res, 'tour');
  if (path0 === '/api/health') return sendJSON(res, 200, { ok: true });
  const rep = /^\/api\/report\/([st][0-9a-f]{11})$/.exec(path0);
  if (rep) { const r = await store.get(`report:${rep[1]}`); return r ? sendJSON(res, 200, r) : sendJSON(res, 404, { error: 'Report not found.' }); }
  if (path0 === '/api/ask' && req.method === 'POST') {
    const { id, question, history } = await readBody(req);
    const report = /^[st][0-9a-f]{11}$/.test(id || '') ? await store.get(`report:${id}`) : null;
    if (!report) return sendJSON(res, 404, { error: 'Report not found.' });
    const q = String(question || '').trim();
    if (q.length < 3 || q.length > 300) return sendJSON(res, 400, { error: 'Ask a question of 3-300 characters.' });
    try { return sendJSON(res, 200, await askReport({ report, question: q, history: Array.isArray(history) ? history.slice(-3) : [] }, { llm: createLLM(process.env), qloo: process.env.QLOO_API_KEY ? makeQloo() : null })); }
    catch (e) { return sendJSON(res, 500, { error: String(e.message || e) }); }
  }
  const path = /^\/r\/[st][0-9a-f]{11}$/.test(path0) ? '/' : normalize(decodeURIComponent(path0)).replace(/^(\.\.[/\\])+/, '');
  try {
    const file = join(root, path === '/' ? 'index.html' : path);
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }); res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(process.env.PORT || 8787, () => console.log(`TasteRouter on http://localhost:${process.env.PORT || 8787}`));
