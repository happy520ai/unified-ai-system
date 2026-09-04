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

  it("sanitizes log keys without invoking accessors or retaining serialization hooks", () => {
    let accessorCalls = 0;
    const input = Object.create(null) as Record<string, unknown>;
    input.safe = "visible";
    input[`Authorization: Bearer ${"A".repeat(24)}`] = "KEY_SECRET_CANARY";
    Object.defineProperty(input, "__proto__", {
      value: { polluted: "PROTOTYPE_CANARY" },
      enumerable: true,
    });
    Object.defineProperty(input, "accessor", {
      get() {
        accessorCalls += 1;
        return "ACCESSOR_CANARY";
      },
      enumerable: true,
    });
    Object.defineProperty(input, "toJSON", {
      value: () => ({ leaked: "TOJSON_LOG_CANARY" }),
      enumerable: true,
    });

    const sanitized = sanitizeLogValue(input) as Record<string, unknown>;
    const serialized = JSON.stringify(sanitized);
    expect(accessorCalls).toBe(0);
    expect(Object.getPrototypeOf(sanitized)).toBeNull();
    expect(Object.hasOwn(sanitized, "__proto__")).toBe(false);
    expect(Object.hasOwn(sanitized, "toJSON")).toBe(false);
    expect(serialized).toContain("visible");
    expect(serialized).not.toMatch(/KEY_SECRET_CANARY|PROTOTYPE_CANARY|ACCESSOR_CANARY|TOJSON_LOG_CANARY/u);
    expect(serialized).not.toContain("A".repeat(24));
  });
});
