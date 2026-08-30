import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { MCP_MODERN_PROTOCOL_VERSION, MCP_TOOL_NAMES } from "./server.js";
import { createGatewayRuntime } from "./runtime.js";

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
  const client = new Client(
    {
      name: "unified-ai-system-mcp-test",
      version: "0.5.0",
    },
    { versionNegotiation: { mode: { pin: MCP_MODERN_PROTOCOL_VERSION } } },
  );
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
    assert.equal(client.getProtocolEra(), "modern");
    assert.equal(client.getNegotiatedProtocolVersion(), MCP_MODERN_PROTOCOL_VERSION);
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
    assert.equal(health.gateway.authenticated, true);
    assert.equal(health.gateway.authVerified, true);
    assert.equal(health.gateway.authTokenExposed, false);
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

    const workflow = parseToolResult(
      await client.callTool({
        name: "workflow_run",
        arguments: {
          goal: "Create one managed MCP workflow report",
          artifactName: "managed-mcp-report.md",
        },
      }),
    );
    assert.equal(workflow.ok, true, JSON.stringify(workflow));
    assert.equal(workflow.result.data.artifact.fileName, "managed-mcp-report.md");
    assert.match(workflow.result.data.artifact.absolutePath, /workflow-artifacts/u);
  } finally {
    await client.close();
  }

  assert.equal(typeof baseUrl, "string");
  await waitForClosed(baseUrl);
});

test("external gateway authentication fails closed before network access", async () => {
  await assert.rejects(
    createGatewayRuntime({
      env: { AI_GATEWAY_MCP_URL: "https://gateway.example.test" },
    }),
    /AI_GATEWAY_MCP_AUTH_TOKEN is required/,
  );
  await assert.rejects(
    createGatewayRuntime({
      env: {
        AI_GATEWAY_MCP_URL: "https://gateway.example.test",
        AI_GATEWAY_MCP_AUTH_TOKEN: "too-short",
      },
    }),
    /at least 32 characters/,
  );
  await assert.rejects(
    createGatewayRuntime({
      env: {
        AI_GATEWAY_MCP_URL: "http://gateway.example.test",
        AI_GATEWAY_MCP_AUTH_TOKEN: "test-only-external-gateway-token-0000000000",
      },
    }),
    /requires HTTPS for non-loopback gateways/,
  );
  await assert.rejects(
    createGatewayRuntime({
      env: {
        AI_GATEWAY_MCP_URL: "https://user:secret@gateway.example.test",
        AI_GATEWAY_MCP_AUTH_TOKEN: "test-only-external-gateway-token-0000000000",
      },
    }),
    /must not contain URL credentials/,
  );
});
