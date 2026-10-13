#!/usr/bin/env node
// Local / self-hosted server: same API and UI as the Cloudflare Worker, on Node 20+ with zero dependencies.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createQloo } from './qloo.js';
import { createLLM } from './llm.js';
import { runScout } from './agent.js';
import { fileStore } from './fileStore.js';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'public');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const store = fileStore(process.env.CACHE_DIR || '.cache');

createServer(async (req, res) => {
  if (req.url === '/api/scout' && req.method === 'POST') {
    let body = ''; for await (const c of req) body += c;
    const input = JSON.parse(body || '{}');
    res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8' });
    const send = ev => res.write(JSON.stringify(ev) + '\n');
    try {
      const qloo = createQloo({ apiKey: process.env.QLOO_API_KEY, baseUrl: process.env.QLOO_API_URL || undefined, store, onCall: c => send({ type: 'qloo_call', path: c.path, ms: c.ms, ok: c.ok, cached: !!c.cached }) });
      await runScout(input, { qloo, llm: createLLM(process.env), store, emit: send });
    } catch (e) { send({ type: 'error', error: String(e.message || e) }); }
    return res.end();
  }
  if (req.url === '/api/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true })); }
  const path = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  try {
    const file = join(root, path === '/' ? 'index.html' : path);
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }); res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(process.env.PORT || 8787, () => console.log(`TasteRouter on http://localhost:${process.env.PORT || 8787}`));
