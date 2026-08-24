import assert from "node:assert/strict";
import test from "node:test";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { resolveMcpHttpConfig, startMcpHttpServer } from "./http.js";
import {
  MCP_COMPAT_PROTOCOL_VERSION,
  MCP_LEGACY_PROTOCOL_VERSION,
  MCP_MODERN_PROTOCOL_VERSION,
  MCP_TOOL_NAMES,
} from "./server.js";

const TEST_TOKEN = "test-only-mcp-http-token-00000000000000000000";

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
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }
  assert.fail(`Managed MCP HTTP gateway remained reachable at ${baseUrl}.`);
}

test("remote MCP HTTP configuration fails closed", () => {
  assert.throws(
    () => resolveMcpHttpConfig({}, { host: "0.0.0.0", port: 3210 }),
    /MCP_HTTP_AUTH_TOKEN/,
  );
  assert.throws(
    () => resolveMcpHttpConfig({}, {
      host: "0.0.0.0",
      port: 3210,
      authToken: TEST_TOKEN,
    }),
    /MCP_HTTP_ALLOWED_HOSTS/,
  );
  assert.throws(
    () => resolveMcpHttpConfig({}, {
      host: "0.0.0.0",
      port: 3210,
      authToken: TEST_TOKEN,
      allowedHostnames: "mcp.example.com",
    }),
    /MCP_HTTP_ALLOWED_ORIGINS/,
  );
});

test("Streamable HTTP exposes safe tools and rejects invalid access", async () => {
  const service = await startMcpHttpServer({
    env: {
      ...process.env,
      AI_GATEWAY_MCP_URL: "",
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      PME_ENTERPRISE_AUTH_ENABLED: "false",
    },
    host: "127.0.0.1",
    port: 0,
    authToken: TEST_TOKEN,
  });
  const client = new Client({
    name: "unified-ai-system-mcp-http-test",
    version: "0.4.9",
  });
  const transport = new StreamableHTTPClientTransport(new URL(service.endpoint), {
    requestInit: {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
    },
  });
  const modernClient = new Client(
    { name: "unified-ai-system-mcp-http-modern-test", version: "0.5.0" },
    { versionNegotiation: { mode: { pin: MCP_MODERN_PROTOCOL_VERSION } } },
  );
  const modernTransport = new StreamableHTTPClientTransport(new URL(service.endpoint), {
    requestInit: {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
    },
  });
  const compatClient = new Client(
    { name: "unified-ai-system-mcp-http-compat-test", version: "0.5.0" },
    { supportedProtocolVersions: [MCP_COMPAT_PROTOCOL_VERSION] },
  );
  const compatTransport = new StreamableHTTPClientTransport(new URL(service.endpoint), {
    requestInit: {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
    },
  });
  let gatewayBaseUrl;

  try {
    const unauthorized = await fetch(service.endpoint);
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.headers.get("www-authenticate"), "Bearer");

    const forbiddenOrigin = await fetch(service.endpoint, {
      headers: {
        Authorization: `Bearer ${TEST_TOKEN}`,
        Origin: "https://not-allowed.example",
      },
    });
    assert.equal(forbiddenOrigin.status, 403);

    const notFound = await fetch(new URL("/not-mcp", service.endpoint));
    assert.equal(notFound.status, 404);

    const preflight = await fetch(service.endpoint, {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "mcp-method,mcp-name,mcp-param-name,x-not-allowed",
      },
    });
    assert.equal(preflight.status, 204);
    const allowedHeaders = preflight.headers.get("access-control-allow-headers")?.toLowerCase() ?? "";
    assert.match(allowedHeaders, /mcp-method/);
    assert.match(allowedHeaders, /mcp-name/);
    assert.match(allowedHeaders, /mcp-param-name/);
    assert.doesNotMatch(allowedHeaders, /x-not-allowed/);

    await client.connect(transport);
    assert.equal(client.getProtocolEra(), "legacy");
    assert.equal(client.getNegotiatedProtocolVersion(), MCP_LEGACY_PROTOCOL_VERSION);
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
    assert.equal(health.result.data.realProviderEnabled, false);
    gatewayBaseUrl = health.gateway.baseUrl;

    const enhancement = parseToolResult(
      await client.callTool({
        name: "gateway_prompt_enhance",
        arguments: {
          input: "Build a protocol-compatible client gateway",
          profile: "coding",
        },
      }),
    );
    assert.equal(enhancement.ok, true);
    assert.equal(enhancement.result.data.profile, "coding");
    assert.equal(enhancement.result.data.metadata.providerCalled, false);

    await modernClient.connect(modernTransport);
    assert.equal(modernClient.getProtocolEra(), "modern");
    assert.equal(modernClient.getNegotiatedProtocolVersion(), MCP_MODERN_PROTOCOL_VERSION);
    const modernListed = await modernClient.listTools();
    assert.deepEqual(
      modernListed.tools.map((tool) => tool.name).sort(),
      [...MCP_TOOL_NAMES].sort(),
    );
    const modernHealth = parseToolResult(
      await modernClient.callTool({ name: "gateway_health", arguments: {} }),
    );
    assert.equal(modernHealth.ok, true);
    assert.equal(modernHealth.gateway.realProviderCallsAllowed, false);

    await compatClient.connect(compatTransport);
    assert.equal(compatClient.getProtocolEra(), "legacy");
    assert.equal(compatClient.getNegotiatedProtocolVersion(), MCP_COMPAT_PROTOCOL_VERSION);
    assert.equal((await compatClient.listTools()).tools.length, MCP_TOOL_NAMES.length);
  } finally {
    await compatClient.close();
    await modernClient.close();
    await client.close();
    await service.stop();
  }

  assert.equal(typeof gatewayBaseUrl, "string");
  await waitForClosed(gatewayBaseUrl);
});
