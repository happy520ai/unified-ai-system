import { describe, it, expect } from "vitest";
import { redactSecret, redactCredentialRef } from "./credentialRedactor.js";

describe("credential-redactor", () => {
  it("returns empty string for null/undefined/empty", () => {
    expect(redactSecret(null)).toBe("");
    expect(redactSecret(undefined)).toBe("");
    expect(redactSecret("")).toBe("");
    expect(redactSecret(0)).toBe("");
  });

  it("returns [redacted] for short strings (<=8 chars)", () => {
    expect(redactSecret("short")).toBe("[redacted]");
    expect(redactSecret("12345678")).toBe("[redacted]");
  });

  it("preserves first 3 and last 3 chars for longer strings", () => {
    const result = redactSecret("sk-ant-very-long-api-key-12345");
    expect(result).toBe("sk-****345");
    expect(result).toHaveLength(10);
  });

  it("handles exactly 9 chars (boundary)", () => {
    expect(redactSecret("123456789")).toBe("123****789");
  });

  it("redactCredentialRef returns empty for falsy values", () => {
    expect(redactCredentialRef(null)).toBe("");
    expect(redactCredentialRef(undefined)).toBe("");
    expect(redactCredentialRef("")).toBe("");
  });

  it("redactCredentialRef prefixes with ref: and applies redaction", () => {
    const result = redactCredentialRef("my-credential-ref-12345");
    expect(result).toMatch(/^ref:/);
    expect(result).not.toContain("my-credential-ref-12345");
  });

  it("redactCredentialRef redacts short refs fully", () => {
    expect(redactCredentialRef("short")).toBe("ref:[redacted]");
  });
});
