import { describe, it, expect } from "vitest";
import { evaluateCredentialAccessPolicy } from "./credentialAccessPolicy.js";

describe("credential-access-policy", () => {
  it("allows default request with default params", () => {
    const result = evaluateCredentialAccessPolicy();
    expect(result.allowed).toBe(true);
    expect(result.code).toBe("CREDENTIAL_ACCESS_ALLOWED");
  });

  it("blocks requests containing secretValue in any nested field", () => {
    const result = evaluateCredentialAccessPolicy({
      request: { data: { secretValue: "sk-xxx" } },
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("SECRET_VALUE_FORBIDDEN");
  });

  it("blocks non-user-owned requests", () => {
    const result = evaluateCredentialAccessPolicy({ userOwned: false });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("CREDENTIAL_ACCESS_DENIED");
  });

  it("blocks disallowed providerScope", () => {
    const result = evaluateCredentialAccessPolicy({ providerScope: "unknown-provider" });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("CREDENTIAL_SCOPE_NOT_ALLOWED");
  });

  it("blocks disallowed modeScope", () => {
    const result = evaluateCredentialAccessPolicy({ modeScope: "invalid" });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("CREDENTIAL_SCOPE_NOT_ALLOWED");
  });

  it("allows all valid providerScopes", () => {
    for (const scope of ["nvidia", "openai", "claude", "openrouter", "mimo"]) {
      const result = evaluateCredentialAccessPolicy({ providerScope: scope });
      expect(result.allowed).toBe(true);
    }
  });

  it("allows all valid modeScopes", () => {
    for (const scope of ["normal", "god", "tianshu"]) {
      const result = evaluateCredentialAccessPolicy({ modeScope: scope });
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks when audit.traceEnabled is explicitly false", () => {
    const result = evaluateCredentialAccessPolicy({
      request: { audit: { traceEnabled: false } },
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("CREDENTIAL_ACCESS_DENIED");
    expect(result.reason).toBe("audit_trace_required");
  });

  it("allows when audit.traceEnabled is true or undefined", () => {
    expect(
      evaluateCredentialAccessPolicy({ request: { audit: { traceEnabled: true } } }).allowed,
    ).toBe(true);
    expect(
      evaluateCredentialAccessPolicy({ request: { audit: {} } }).allowed,
    ).toBe(true);
  });
});
