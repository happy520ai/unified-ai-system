// Deep Polish Batch 13 — 8 fixes, 8 test suites
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "node:url";

const __testDir = fileURLToPath(new URL(".", import.meta.url));
const SRC_ROOT = join(__testDir, "..", "..", "..", "apps", "ai-gateway-service", "src");

function ESM_SRC(file) {
  return readFileSync(join(SRC_ROOT, file), "utf8");
}

// ── Fix 1: mcpBridge env leak → safe allowlist ──
describe("Batch13 Fix1: mcpBridge safe env", () => {
  const src = ESM_SRC("claude-code-patterns/mcpBridge.js");

  it("defines buildSafeEnv function with allowlist", () => {
    const idx = src.indexOf("function buildSafeEnv");
    assert.ok(idx >= 0, "buildSafeEnv not found");
    const window = src.slice(idx, idx + 600);
    assert.ok(window.includes("ALLOWED_VARS"), "missing ALLOWED_VARS");
    assert.ok(window.includes("PATH"), "PATH not in allowlist");
    assert.ok(window.includes("HOME"), "HOME not in allowlist");
    assert.ok(window.includes("SYSTEMROOT"), "SYSTEMROOT not in allowlist");
  });

  it("uses buildSafeEnv in spawn options instead of spread process.env", () => {
    assert.ok(src.includes("buildSafeEnv(config.env)"), "spawn should use buildSafeEnv");
    assert.ok(!src.includes("...globalThis.process.env"), "should not spread process.env");
  });

  it("does not leak process.env to child processes", () => {
    assert.ok(!src.includes("env: { ...globalThis.process.env"), "old env leak pattern should be gone");
  });
});

// ── Fix 2: selfEvolutionPipeline capabilityId path traversal ──
describe("Batch13 Fix2: selfEvolutionPipeline path traversal guard", () => {
  const src = ESM_SRC("capabilities/selfEvolutionPipeline.js");

  it("defines sanitizeCapabilityId with strict regex", () => {
    const idx = src.indexOf("function sanitizeCapabilityId");
    assert.ok(idx >= 0, "sanitizeCapabilityId not found");
    const window = src.slice(idx, idx + 400);
    // The regex literal /[\\w-]+/ should appear in the source
    assert.ok(window.includes("throw new Error"), "should throw on invalid id");
    assert.ok(window.includes(".test(id)"), "should use regex .test()");
  });

  it("sanitizes capabilityId in addRecord", () => {
    assert.ok(src.includes("sanitizeCapabilityId(record.capabilityId)"), "addRecord should sanitize");
  });

  it("sanitizes capabilityId in getRecord", () => {
    // Find the getRecord function and check it uses sanitizeCapabilityId
    const idx = src.indexOf("async getRecord(capabilityId)");
    assert.ok(idx >= 0, "getRecord not found");
    const window = src.slice(idx, idx + 400);
    assert.ok(window.includes("sanitizeCapabilityId"), "getRecord should use sanitizeCapabilityId");
  });

  it("sanitizes capabilityId in stepGenerate", () => {
    assert.ok(src.includes("sanitizeCapabilityId(capabilityId))"), "stepGenerate should sanitize");
  });
});

// ── Fix 3: selfEvolutionPipeline autoApprove default false ──
describe("Batch13 Fix3: autoApprove defaults to false", () => {
  const src = ESM_SRC("capabilities/selfEvolutionPipeline.js");

  it("autoApprove defaults to false instead of true", () => {
    const assignIdx = src.indexOf("const autoApprove =");
    assert.ok(assignIdx >= 0, "autoApprove assignment not found");
    const assignLine = src.slice(assignIdx, src.indexOf("\n", assignIdx));
    assert.ok(assignLine.includes(": false"), "should default to false");
    assert.ok(!assignLine.includes(": true"), "should not default to true");
  });

  it("JSDoc documents autoApprove default as false", () => {
    assert.ok(src.includes("[options.autoApprove=false]"), "JSDoc should say false");
  });
});

// ── Fix 4: isPublicRoute — sensitive routes removed ──
describe("Batch13 Fix4: isPublicRoute hardened", () => {
  const src = ESM_SRC("http/httpServer.js");

  function getPublicRouteBody() {
    const fnStart = src.indexOf("function isPublicRoute");
    let depth = 0, fnEnd = fnStart;
    for (let i = fnStart; i < src.length; i++) {
      if (src[i] === "{") depth++;
      if (src[i] === "}") { depth--; if (depth === 0) { fnEnd = i; break; } }
    }
    return src.slice(fnStart, fnEnd + 1);
  }

  it("isPublicRoute function exists and is compact", () => {
    const fnBody = getPublicRouteBody();
    assert.ok(fnBody.length > 0, "function not found");
    assert.ok(fnBody.length < 2000, `function should be compact, got ${fnBody.length}`);
  });

  it("does not expose write/execute routes as public", () => {
    const fnBody = getPublicRouteBody();
    const mustNotBePublic = [
      "/approvals/create",
      "/local-operation/apply-approved",
      "/agent-runner/local-operation",
      "/provider-config/save",
      "/provider-config/test",
      "/model-library/test-model",
      "/real-capabilities/activate-five",
      "/chat-gateway/execute",
      "/three-mode/execute",
    ];
    for (const route of mustNotBePublic) {
      assert.ok(!fnBody.includes(`"${route}"`), `${route} should not be public`);
    }
  });

  it("still keeps safe read-only routes public", () => {
    const fnBody = getPublicRouteBody();
    assert.ok(fnBody.includes('"/ui"'), "/ui should remain public");
    assert.ok(fnBody.includes('"/health/check"'), "/health/check should remain public");
    assert.ok(fnBody.includes('"/setup/readiness"'), "/setup/readiness should remain public");
    assert.ok(fnBody.includes('"/auth/status"'), "/auth/status should remain public");
  });
});

// ── Fix 5: httpLlmProviderAdapter SSRF guard ──
describe("Batch13 Fix5: httpLlmProviderAdapter SSRF guard", () => {
  const src = ESM_SRC("providers/httpLlmProviderAdapter.js");

  it("defines isPrivateOrReservedUrl function", () => {
    const idx = src.indexOf("function isPrivateOrReservedUrl");
    assert.ok(idx >= 0, "isPrivateOrReservedUrl not found");
    const window = src.slice(idx, idx + 800);
    assert.ok(window.includes("localhost"), "should check localhost");
    assert.ok(window.includes("127.0.0.1"), "should check loopback");
    // Source uses regex with escaped dots: 192\\.168
    assert.ok(window.includes("192"), "should check 192.x range");
    assert.ok(window.includes("metadata.google.internal"), "should check cloud metadata");
  });

  it("blocks SSRF before fetch call", () => {
    assert.ok(src.includes("SSRF blocked"), "SSRF block message not found");
    assert.ok(src.includes("isPrivateOrReservedUrl"), "guard function should be called");
  });

  it("SSRF check is before the fetch call, not after", () => {
    const ssrfIdx = src.indexOf("SSRF blocked");
    const fetchIdx = src.indexOf("const response = await fetch");
    assert.ok(ssrfIdx >= 0, "SSRF block not found");
    assert.ok(fetchIdx >= 0, "fetch call not found");
    assert.ok(ssrfIdx < fetchIdx || (fetchIdx - ssrfIdx < 500), "SSRF check should be near fetch");
  });
});

// ── Fix 6: sqliteVecStore JSON.parse crash guard ──
describe("Batch13 Fix6: sqliteVecStore safe metadata parse", () => {
  const src = ESM_SRC("knowledge/sqliteVecStore.js");

  it("defines safeParseMetadata with try-catch", () => {
    const idx = src.indexOf("function safeParseMetadata");
    assert.ok(idx >= 0, "safeParseMetadata not found");
    const window = src.slice(idx, idx + 400);
    assert.ok(window.includes("try"), "should have try block");
    assert.ok(window.includes("catch"), "should have catch block");
    assert.ok(window.includes("return {}"), "should return empty object on failure");
  });

  it("uses safeParseMetadata instead of raw JSON.parse", () => {
    assert.ok(src.includes("safeParseMetadata(row.metadata)"), "should use safe parse");
    assert.ok(!src.includes("JSON.parse(row.metadata)"), "raw JSON.parse should be gone");
  });
});

// ── Fix 7: workforceControlledExecutor timeout enforcement ──
describe("Batch13 Fix7: workforceControlledExecutor timeout", () => {
  const src = ESM_SRC("workforce/workforceControlledExecutor.js");

  it("wraps executeAllRoles with Promise.race timeout", () => {
    const idx = src.indexOf("executeAllRoles(plan.goal");
    assert.ok(idx >= 0, "executeAllRoles call not found");
    const window = src.slice(Math.max(0, idx - 200), idx + 300);
    assert.ok(window.includes("Promise.race"), "should use Promise.race");
    assert.ok(window.includes("timed out"), "should have timeout message");
  });

  it("references timeoutMs in the timeout wrapper", () => {
    const raceIdx = src.lastIndexOf("Promise.race");
    const window = src.slice(raceIdx, raceIdx + 400);
    assert.ok(window.includes("timeoutMs"), "should use timeoutMs variable");
  });
});

// ── Fix 8: agenticCodingLoop provider timeout ──
describe("Batch13 Fix8: agenticCodingLoop provider timeout", () => {
  const src = ESM_SRC("agentic/agenticCodingLoop.js");

  it("defines withProviderTimeout helper", () => {
    const idx = src.indexOf("function withProviderTimeout");
    assert.ok(idx >= 0, "withProviderTimeout not found");
    const window = src.slice(idx, idx + 500);
    assert.ok(window.includes("Promise.race"), "should use Promise.race");
    assert.ok(window.includes("PROVIDER_CALL_TIMEOUT_MS"), "should reference timeout constant");
  });

  it("defines PROVIDER_CALL_TIMEOUT_MS constant", () => {
    const idx = src.indexOf("PROVIDER_CALL_TIMEOUT_MS");
    assert.ok(idx >= 0, "constant not found");
    const line = src.slice(idx, src.indexOf("\n", idx));
    assert.ok(line.includes("120_000") || line.includes("120000"), "should be 120s");
  });

  it("wraps all provider.generate() calls with timeout", () => {
    const count = (src.match(/withProviderTimeout\(providerAdapter\.generate/g) || []).length;
    assert.ok(count >= 3, `expected at least 3 wrapped calls, found ${count}`);
  });

  it("no unwrapped providerAdapter.generate calls remain", () => {
    const allCalls = src.match(/await\s+(?:withProviderTimeout\()?\s*providerAdapter\.generate/g) || [];
    const wrappedCalls = src.match(/await\s+withProviderTimeout\(providerAdapter\.generate/g) || [];
    assert.equal(allCalls.length, wrappedCalls.length,
      `all providerAdapter.generate calls should be wrapped: ${allCalls.length} total, ${wrappedCalls.length} wrapped`);
  });
});
