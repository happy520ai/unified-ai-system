// Hosted demo: GET / serves the UI, POST /api/recommend runs the agent.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createQlooClient } from './qlooClient.js';
import { createTasteAgent, createLlmFromEnv } from './agent.js';

const PORT = Number(process.env.PORT || 8787);
const agent = createTasteAgent({ qloo: createQlooClient(), llm: createLlmFromEnv() });
const page = new URL('../public/index.html', import.meta.url);

createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(await readFile(page));
    }
    if (req.method === 'GET' && req.url === '/healthz') return res.end('ok');
    if (req.method === 'POST' && req.url === '/api/recommend') {
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 1e5) throw new Error('payload too large'); }
      const out = await agent.recommend(JSON.parse(body || '{}'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(out));
    }
    res.writeHead(404).end('not found');
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: err.message }));
  }
}).listen(PORT, () => console.log(`TasteRouter demo on http://localhost:${PORT}`));
