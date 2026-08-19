import { describe, expect, it } from "vitest";
import { Writable } from "node:stream";
import { createPinoLogger } from "./pinoLogger.js";

describe("pino logger security", () => {
  it("redacts credentials in headers, nested fields, and text", async () => {
    let output = "";
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const logger = createPinoLogger({ app: "test", destination });
    logger.info({
      req: {
        method: "POST",
        url: "/providers",
        headers: {
          authorization: "Bearer bearer-secret-value",
          cookie: "session=private",
        },
      },
      apiKey: "sk-provider-secret",
      nested: { token: "nested-secret" },
      message: "https://example.test/?token=query-secret",
      safe: "visible",
    }, "audit");
    await new Promise<void>((resolve) => destination.end(resolve));

    expect(output).toContain("visible");
    expect(output).not.toContain("bearer-secret-value");
    expect(output).not.toContain("session=private");
    expect(output).not.toContain("sk-provider-secret");
    expect(output).not.toContain("nested-secret");
    expect(output).not.toContain("query-secret");
  });
});
