import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";

import { createGatewayClient, GatewayClientError } from "./index.js";

async function startServer(handler) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  assert.ok(address && typeof address === "object");

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function closeServer(server) {
  if (server.listening) {
    server.close();
    await once(server, "close");
  }
}

test("validates and normalizes the gateway base URL", () => {
  assert.throws(
    () => createGatewayClient(),
    (error) =>
      error instanceof GatewayClientError &&
      error.message === "Gateway baseUrl is required",
  );
  assert.throws(
    () => createGatewayClient({ baseUrl: "   " }),
    (error) => error instanceof GatewayClientError,
  );
  assert.equal(
    createGatewayClient({ baseUrl: " http://127.0.0.1:3100/// " }).baseUrl,
    "http://127.0.0.1:3100",
  );
});

test("preserves status and JSON body for non-2xx responses", async () => {
  const { server, baseUrl } = await startServer((_request, response) => {
    response.writeHead(429, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "rate limited", retryAfterMs: 250 }));
  });

  try {
    await assert.rejects(
      createGatewayClient({ baseUrl }).health(),
      (error) =>
        error instanceof GatewayClientError &&
        error.statusCode === 429 &&
        error.responseBody?.error === "rate limited" &&
        error.responseBody?.retryAfterMs === 250,
    );
  } finally {
    await closeServer(server);
  }
});

test("reports invalid JSON with response context", async () => {
  const { server, baseUrl } = await startServer((_request, response) => {
    response.writeHead(502, { "content-type": "text/plain" });
    response.end("upstream unavailable");
  });

  try {
    await assert.rejects(
      createGatewayClient({ baseUrl }).health(),
      (error) =>
        error instanceof GatewayClientError &&
        error.message === "Gateway returned invalid JSON" &&
        error.statusCode === 502 &&
        error.responseBody === "upstream unavailable" &&
        error.cause instanceof Error,
    );
  } finally {
    await closeServer(server);
  }
});

test("wraps network failures as GatewayClientError", async () => {
  const { server, baseUrl } = await startServer((_request, response) => {
    response.end(JSON.stringify({ ok: true }));
  });
  await closeServer(server);

  await assert.rejects(
    createGatewayClient({ baseUrl }).health(),
    (error) =>
      error instanceof GatewayClientError &&
      error.message === "Gateway request failed" &&
      error.cause instanceof Error,
  );
});
