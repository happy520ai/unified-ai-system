import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { EOL, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createMcpClient } from "./mcpClient.js";
import { PROTOCOL_VERSION as GATEWAY_REVISION } from "../mcpGateway/mcpUpstreamClient.ts";
describe('mcpClient tools/list pagination (#177)', () => {
  // The third call site had no test before this and no transport seam, so the fake is a real
  // child process speaking the newline-delimited JSON-RPC this transport parses. It is written
  // to a temp file at run time rather than tracked, because its whole job is to be this test's
  // counterparty.
  const tmpRoots = [];
  afterEach(() => {
    for (const dir of tmpRoots.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function fakeServer(lines) {
    const dir = mkdtempSync(join(tmpdir(), "mcp-page-fake-"));
    tmpRoots.push(dir);
    const file = join(dir, "server.cjs");
    writeFileSync(file, [
      'const rl = require("readline").createInterface({ input: process.stdin });',
      'const send = (o) => process.stdout.write(JSON.stringify(o) + "\\n");',
      'const PAGES = ' + JSON.stringify(lines) + ';',
      'let page = 0;',
      'rl.on("line", (line) => {',
      '  let msg; try { msg = JSON.parse(line); } catch { return; }',
      '  if (msg.id === undefined) return;',
      '  if (msg.method === "initialize") return send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: msg.params?.protocolVersion, capabilities: {}, serverInfo: { name: "fake", version: "1" } } });',
      '  if (msg.method === "tools/list") {',
      '    const expected = page === 0 ? undefined : PAGES[page - 1].nextCursor;',
      '    if (msg.params?.cursor !== expected) return send({ jsonrpc: "2.0", id: msg.id, error: { code: -1, message: "unexpected cursor " + String(msg.params?.cursor) } });',
      '    const out = PAGES[page]; page += 1;',
      '    return send({ jsonrpc: "2.0", id: msg.id, result: out });',
      '  }',
      '  send({ jsonrpc: "2.0", id: msg.id, result: {} });',
      '});',
    ].join(EOL));
    return file;
  }

  const clientFor = (pages) => createMcpClient({
    name: "fixture",
    transport: "stdio",
    command: process.execPath,
    args: [fakeServer(pages)],
  });

  it("declares the revision the gateway's own MCP client declares (#178)", async () => {
    // The fake answers with whatever it was asked, so this compares the bytes that actually went
    // on the wire against the other client's constant - not against a second copy of the same
    // literal. Two MCP client paths inside one product disagreeing is invisible from either alone.
    const client = clientFor([{ tools: [] }]);
    const connected = await client.connect();
    expect(connected.protocolVersion).toBe(GATEWAY_REVISION);
    client.disconnect();
  });

  it("walks to the second page and namespaces every tool it finds", async () => {
    const client = clientFor([
      { tools: [{ name: "alpha", description: "a", inputSchema: { type: "object" } }], nextCursor: "p2" },
      { tools: [{ name: "beta", description: "b", inputSchema: { type: "object" } }] },
    ]);
    await client.connect();
    const listed = await client.listTools();
    expect(listed.status).toBe("success");
    expect(listed.tools.map((t) => t.originalName)).toEqual(["alpha", "beta"]);
    client.disconnect();
  });

  it("reports an error rather than a short list when the walk cannot finish", async () => {
    const pages = Array.from({ length: 30 }, () => ({ tools: [{ name: "x", inputSchema: { type: "object" } }], nextCursor: "same" }));
    const client = clientFor(pages);
    await client.connect();
    const listed = await client.listTools();
    expect(listed.status).toBe("error");
    expect(listed.error).toMatch(/cursor/);
    client.disconnect();
  });
});

