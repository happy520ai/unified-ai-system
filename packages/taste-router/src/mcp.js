#!/usr/bin/env node
// Zero-dependency MCP server (stdio, JSON-RPC 2.0, newline-delimited).
// Add to any MCP client: { "command": "node", "args": ["packages/taste-router/src/mcp.js"], "env": { "QLOO_API_KEY": "..." } }
import { createInterface } from 'node:readline';
import { createQlooClient } from './qlooClient.js';
import { createTasteAgent, createLlmFromEnv } from './agent.js';
import { TOOLS, callTool } from './tools.js';

export function createMcpHandler(agent) {
  return async function handle(msg) {
    const { id, method, params = {} } = msg;
    const ok = (result) => ({ jsonrpc: '2.0', id, result });
    switch (method) {
      case 'initialize':
        return ok({
          protocolVersion: params.protocolVersion || '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: 'taste-router', version: '0.1.0' },
        });
      case 'notifications/initialized':
        return null;
      case 'ping':
        return ok({});
      case 'tools/list':
        return ok({ tools: TOOLS });
      case 'tools/call':
        try {
          const out = await callTool(agent, params.name, params.arguments);
          return ok({ content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] });
        } catch (err) {
          return ok({ content: [{ type: 'text', text: err.message }], isError: true });
        }
      default:
        return id === undefined ? null : { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
    }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const agent = createTasteAgent({ qloo: createQlooClient(), llm: createLlmFromEnv(), log: (m) => console.error(m) });
  const handle = createMcpHandler(agent);
  const rl = createInterface({ input: process.stdin });
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    const reply = await handle(msg);
    if (reply) process.stdout.write(JSON.stringify(reply) + '\n');
  });
}
