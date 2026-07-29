import { describe, expect, it } from "vitest";
import { isAuthorized } from "./userExperienceService.js";

const enabledAuth = {
  enabled: true,
  expectedToken: "enterprise-secret",
};

describe("user experience authorization", () => {
  it("allows requests when authentication is disabled", () => {
    expect(isAuthorized({ enabled: false }, undefined)).toBe(true);
  });

  it("accepts exact header and bearer tokens", () => {
    expect(isAuthorized(enabledAuth, {
      headers: { "x-pme-auth-token": "enterprise-secret" },
    })).toBe(true);
    expect(isAuthorized(enabledAuth, {
      headers: { authorization: "Bearer enterprise-secret" },
    })).toBe(true);
  });

  it("rejects missing, malformed, and mismatched tokens without throwing", () => {
    expect(isAuthorized(enabledAuth, undefined)).toBe(false);
    expect(isAuthorized(enabledAuth, { headers: {} })).toBe(false);
    expect(isAuthorized(enabledAuth, {
      headers: { "x-pme-auth-token": 1234 },
    })).toBe(false);
    expect(isAuthorized(enabledAuth, {
      headers: { authorization: "Bearer wrong-length" },
    })).toBe(false);
    expect(isAuthorized(enabledAuth, {
      headers: { authorization: "Basic enterprise-secret" },
    })).toBe(false);
  });

  it("compares UTF-8 byte lengths safely", () => {
    expect(isAuthorized({
      enabled: true,
      expectedToken: "密钥",
    }, {
      headers: { "x-pme-auth-token": "秘密" },
    })).toBe(false);
  });
});
