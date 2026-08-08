import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { MCP_TOOL_NAMES } from "./server.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serverEntrypoint = resolve(packageRoot, "src/index.js");

function parseToolResult(result) {
  const text = result.content?.find((item) => item.type === "text")?.text;
  assert.equal(typeof text, "string");
  return JSON.parse(text);
}

async function waitForClosed(baseUrl) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    try {
      await fetch(`${baseUrl}/health/check`, {
        signal: AbortSignal.timeout(500),
      });
    } catch {
      return;
    }
    await new Promise((resolvePromise) => {
      setTimeout(resolvePromise, 200);
    });
  }
  assert.fail(`Managed MCP gateway remained reachable at ${baseUrl}.`);
}

test("stdio server exposes safe tools and cleans up its managed gateway", async () => {
  const client = new Client({
    name: "unified-ai-system-mcp-test",
    version: "0.4.1",
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntrypoint],
    cwd: packageRoot,
    env: {
      ...process.env,
      AI_GATEWAY_MCP_URL: "",
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      PME_ENTERPRISE_AUTH_ENABLED: "false",
    },
  });
  let baseUrl;

  try {
    await client.connect(transport);
    const listed = await client.listTools();
    assert.deepEqual(
      listed.tools.map((tool) => tool.name).sort(),
      [...MCP_TOOL_NAMES].sort(),
    );

    const health = parseToolResult(
      await client.callTool({ name: "gateway_health", arguments: {} }),
    );
    assert.equal(health.ok, true);
    assert.equal(health.gateway.managed, true);
    assert.equal(health.gateway.realProviderCallsAllowed, false);
    assert.equal(health.result.data.status, "ready");
    assert.equal(health.result.data.realProviderEnabled, false);
    baseUrl = health.gateway.baseUrl;

    const readiness = parseToolResult(
      await client.callTool({ name: "gateway_readiness", arguments: {} }),
    );
    assert.equal(readiness.ok, true);
    assert.equal(readiness.result.data.readiness.chat.ready, true);

    const enhancement = parseToolResult(
      await client.callTool({
        name: "gateway_prompt_enhance",
        arguments: {
          input: "Build a Node API with tests",
          profile: "coding",
        },
      }),
    );
    assert.equal(enhancement.ok, true);
    assert.equal(enhancement.result.data.profile, "coding");
    assert.equal(enhancement.result.data.metadata.providerCalled, false);
    assert.match(
      enhancement.result.data.enhancedPrompt,
      /Build a Node API with tests/,
    );

    const chat = parseToolResult(
      await client.callTool({
        name: "gateway_chat",
        arguments: { prompt: "MCP safety smoke test" },
      }),
    );
    assert.equal(chat.ok, true);
    assert.equal(chat.result.data.executionMode, "fake");
    assert.equal(chat.result.data.selectedProvider, "local-fake-provider");

    for (const name of [
      "knowledge_readiness",
      "workflow_health",
      "workflow_actions",
      "workforce_health",
      "workforce_agents",
    ]) {
      const result = parseToolResult(
        await client.callTool({ name, arguments: {} }),
      );
      assert.equal(result.ok, true, `${name} should succeed`);
    }
  } finally {
    await client.close();
  }

  assert.equal(typeof baseUrl, "string");
  await waitForClosed(baseUrl);
});
