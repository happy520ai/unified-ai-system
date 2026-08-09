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

test("sends the expected method, path, headers, and JSON body", async () => {
  let request;
  const { server, baseUrl } = await startServer(async (incoming, response) => {
    request = {
      method: incoming.method,
      url: incoming.url,
      headers: incoming.headers,
      body: "",
    };
    for await (const chunk of incoming) request.body += chunk;

    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
  });

  try {
    const result = await createGatewayClient({
      baseUrl,
      headers: { "x-test-client": "shared-sdk" },
    }).enhancePrompt({ input: "Build an API", profile: "coding" });

    assert.deepEqual(result, { status: "ok" });
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/prompts/enhance");
    assert.equal(request.headers["x-test-client"], "shared-sdk");
    assert.deepEqual(JSON.parse(request.body), {
      input: "Build an API",
      profile: "coding",
    });
  } finally {
    await closeServer(server);
  }
});

test("parses multiple server-sent events from chatStream", async () => {
  const { server, baseUrl } = await startServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(
      [
        "event: start",
        'data: {"id":"stream-1"}',
        "",
        "event: chunk",
        'data: {"text":"hello"}',
        "",
        "event: done",
        'data: {"text":"hello world"}',
        "",
      ].join("\n"),
    );
  });

  try {
    const events = [];
    for await (const event of createGatewayClient({ baseUrl }).chatStream({
      messages: [{ role: "user", content: "Hello" }],
    })) {
      events.push(event);
    }

    assert.deepEqual(events, [
      { id: "stream-1" },
      { text: "hello" },
      { text: "hello world" },
    ]);
  } finally {
    await closeServer(server);
  }
});

test("surfaces stream error events as GatewayClientError", async () => {
  const { server, baseUrl } = await startServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(["event: error", 'data: {"code":"provider_unavailable"}', ""].join("\n"));
  });

  try {
    const stream = createGatewayClient({ baseUrl }).chatStream({
      messages: [{ role: "user", content: "Hello" }],
    });

    await assert.rejects(
      (async () => {
        for await (const _event of stream) {
          // The stream should fail before yielding an event.
        }
      })(),
      (error) =>
        error instanceof GatewayClientError &&
        error.statusCode === 200 &&
        error.responseBody?.code === "provider_unavailable",
    );
  } finally {
    await closeServer(server);
  }
});

test("wraps timeout aborts while preserving the transport cause", async () => {
  const { server, baseUrl } = await startServer((_request, response) => {
    setTimeout(() => {
      if (!response.destroyed) response.end(JSON.stringify({ ok: true }));
    }, 100);
  });

  try {
    await assert.rejects(
      createGatewayClient({ baseUrl, timeoutMs: 10 }).health(),
      (error) =>
        error instanceof GatewayClientError &&
        error.message === "Gateway request failed" &&
        error.statusCode === undefined &&
        error.cause instanceof Error,
    );
  } finally {
    await closeServer(server);
  }
});
