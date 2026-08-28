import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { destroyAllPools, fetchWithAgent, getOrCreateAgent } from "./connectionPool.js";

afterEach(() => destroyAllPools());

describe("connection pool response limits", () => {
  it("aborts a response before buffering beyond the caller limit", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("x".repeat(4096));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server did not bind");
    const url = `http://127.0.0.1:${address.port}/large`;

    try {
      const response = await fetchWithAgent(url, {
        agent: getOrCreateAgent(url),
        maxResponseBytes: 64,
      });
      await expect(response.text()).rejects.toMatchObject({ code: "RESPONSE_BODY_TOO_LARGE" });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
