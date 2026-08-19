import { describe, expect, it } from "vitest";
import {
  sanitizeLogText,
  sanitizeLogValue,
  summarizeErrorForLog,
} from "./logSanitizationPolicy.js";

describe("log sanitization policy", () => {
  it("redacts nested credential fields and secret-shaped text", () => {
    const value = sanitizeLogValue({
      safe: "visible",
      headers: {
        authorization: "Bearer bearer-value-that-must-disappear",
        cookie: "session=private",
      },
      apiKey: "sk-" + "provider-secret-value",
      nested: {
        message: "failed URL https://example.test/?token=query-secret",
      },
    });
    const serialized = JSON.stringify(value);

    expect(serialized).toContain("visible");
    expect(serialized).not.toContain("bearer-value-that-must-disappear");
    expect(serialized).not.toContain("session=private");
    expect(serialized).not.toContain("sk-" + "provider-secret-value");
    expect(serialized).not.toContain("query-secret");
  });

  it("bounds circular, binary, and oversized values", () => {
    const circular: Record<string, unknown> = { payload: Buffer.from("private") };
    circular.self = circular;
    const value = sanitizeLogValue(circular);
    expect(value).toMatchObject({
      payload: "[buffer:7 bytes]",
      self: "[circular]",
    });
    expect(sanitizeLogText("x".repeat(9000))).toContain("[truncated]");
  });

  it("summarizes errors without paths, messages, or stacks", () => {
    const error = Object.assign(new Error("secret path"), {
      code: "EACCES",
      category: "filesystem",
    });
    expect(summarizeErrorForLog(error)).toEqual({
      name: "Error",
      code: "EACCES",
      category: "filesystem",
    });
  });
});
