#!/usr/bin/env node
// Zero-dependency MCP server (stdio, JSON-RPC 2.0, newline-delimited) exposing TasteRouter's Qloo tools
// plus the full `scout_location` agent, so Claude / Cursor / Codex agents get the same cultural grounding.
import { createInterface } from 'node:readline';
import { createQloo } from './qloo.js';
import { createLLM } from './llm.js';
import { makeTools, TOOL_SPECS } from './tools.js';
import { runScout } from './agent.js';
import { geocodeCity } from './geocode.js';

const SCOUT_SPEC = { name: 'scout_location', description: 'Run the full TasteRouter agent: find the neighbourhood in a city whose residents already share a concept\'s taste, with competition and a launch brief. Pass a free-text brief, or city + seeds.', parameters: { type: 'object', properties: { brief: { type: 'string' }, city: { type: 'string' }, concept: { type: 'string' }, seeds: { type: 'array', items: { type: 'string' } } } } };

export function createMcpHandler(env = process.env) {
  const qloo = createQloo({ apiKey: env.QLOO_API_KEY, baseUrl: env.QLOO_API_URL || undefined });
  const llm = createLLM(env);
  const tools = makeTools(qloo);
  const specs = [SCOUT_SPEC, ...TOOL_SPECS].map(t => ({ name: t.name, description: t.description, inputSchema: t.parameters }));
  return async function handle({ id, method, params = {} }) {
    const ok = result => ({ jsonrpc: '2.0', id, result });
    switch (method) {
      case 'initialize': return ok({ protocolVersion: params.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'taste-router', version: '1.0.0' } });
      case 'notifications/initialized': return null;
      case 'ping': return ok({});
      case 'tools/list': return ok({ tools: specs });
      case 'tools/call': try {
        const a = params.arguments || {};
        let out;
        if (params.name === 'scout_location') { const r = await runScout(a, { qloo, llm, withBaseline: false }); out = { brief: r.brief, neighborhoods: r.neighborhoods.map(({ cells, ...h }) => h), audience: r.audience, programming: r.programming }; }
        else if (params.name === 'hotspots' && a.city && !a.center) out = await tools.hotspots({ ...a, center: await geocodeCity(a.city) });
        else if (tools[params.name]) out = await tools[params.name](a);
        else throw new Error(`Unknown tool ${params.name}`);
        return ok({ content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] });
      } catch (e) { return ok({ content: [{ type: 'text', text: String(e.message || e) }], isError: true }); }
      default: return id === undefined ? null : { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
    }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const handle = createMcpHandler();
  createInterface({ input: process.stdin }).on('line', async line => {
    if (!line.trim()) return;
    let msg; try { msg = JSON.parse(line); } catch { return; }
    const reply = await handle(msg);
    if (reply) process.stdout.write(JSON.stringify(reply) + '\n');
  });
}
