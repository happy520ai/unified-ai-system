#!/usr/bin/env node

import { createServer } from "node:http";
import { createGatewayClient } from "../../packages/shared-sdk/src/index.js";

const server = createServer((request, response) => {
  if (request.method !== "POST" || request.url !== "/chat") {
    response.writeHead(404);
    response.end();
    return;
  }

  request.resume();
  requestCount += 1;
  for (let index = requestWaiters.length - 1; index >= 0; index -= 1) {
    const waiter = requestWaiters[index];
    if (requestCount >= waiter.target) {
      requestWaiters.splice(index, 1);
      waiter.resolve();
    }
  }
});

const sockets = new Set();
const requestWaiters = [];
let requestCount = 0;

server.on("connection", (socket) => {
  sockets.add(socket);
  socket.once("close", () => sockets.delete(socket));
});

function waitForRequest(target) {
  if (requestCount >= target) return Promise.resolve();
  return new Promise((resolve) => requestWaiters.push({ target, resolve }));
}

async function expectRejection(promise, label) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error(`${label} unexpectedly resolved.`);
}

async function closeServer() {
  for (const socket of sockets) socket.destroy();
  if (server.listening) {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function main() {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  if (!port) throw new Error("The loopback server did not expose a port.");

  const baseUrl = `http://127.0.0.1:${port}`;
  const message = { messages: [{ role: "user", content: "Cancellation proof" }] };

  try {
    const callerReason = new Error("caller-cancelled");
    const callerController = new AbortController();
    const callerClient = createGatewayClient({
      baseUrl,
      signal: callerController.signal,
      timeoutMs: 5_000,
    });
    const callerRequest = callerClient.chat(message);
    await waitForRequest(1);
    callerController.abort(callerReason);
    const callerError = await expectRejection(callerRequest, "Caller cancellation");

    if (callerError?.name !== "GatewayClientError" || callerError.cause !== callerReason) {
      throw new Error("Caller cancellation did not preserve its transport cause.");
    }

    const timeoutClient = createGatewayClient({ baseUrl, timeoutMs: 1_000 });
    const timeoutRequest = timeoutClient.chat(message);
    await waitForRequest(2);
    const timeoutError = await expectRejection(timeoutRequest, "Timeout");

    if (timeoutError?.name !== "GatewayClientError" || timeoutError.cause?.name !== "TimeoutError") {
      throw new Error("Timeout did not expose a TimeoutError cause.");
    }

    console.log(JSON.stringify({
      client: "@unified-ai-system/shared-sdk",
      transport: "loopback-stub",
      providerCalled: false,
      callerCancellation: {
        error: callerError.name,
        cause: callerError.cause.message,
      },
      timeout: {
        error: timeoutError.name,
        cause: timeoutError.cause.name,
      },
    }, null, 2));
  } finally {
    await closeServer();
  }
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Shared SDK cancellation example failed: ${message}`);
  process.exitCode = 1;
}
