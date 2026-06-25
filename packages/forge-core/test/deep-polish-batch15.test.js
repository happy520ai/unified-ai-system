// Deep Polish Batch 15 — 8 fixes, 8 test suites
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

// ── Fix 1: executionLifecycle.js — path traversal guard ──
describe("Batch15 Fix1: executionLifecycle sanitizePlanId", () => {
  const src = ESM_SRC("workforce/executionLifecycle.js");

  it("defines sanitizePlanId helper function", () => {
    const idx = src.indexOf("function sanitizePlanId");
    assert.ok(idx >= 0, "sanitizePlanId function should exist");
    const window = src.slice(idx, idx + 300);
    assert.ok(window.includes("[^a-zA-Z0-9_.\\-]"), "should strip dangerous path chars");
    assert.ok(window.includes(".slice(0, 128)"), "should cap length at 128");
  });

  it("sanitizes planId in persistState", () => {
    const fnIdx = src.indexOf("async function persistState");
    assert.ok(fnIdx >= 0, "persistState should exist");
    const fnSrc = src.slice(fnIdx, fnIdx + 400);
    assert.ok(fnSrc.includes("sanitizePlanId(planId)"), "persistState should sanitize planId");
    assert.ok(!fnSrc.includes("${planId}.json"), "should not use raw planId in path");
  });

  it("sanitizes planId in loadState", () => {
    const fnIdx = src.indexOf("async function loadState");
    assert.ok(fnIdx >= 0, "loadState should exist");
    const fnSrc = src.slice(fnIdx, fnIdx + 400);
    assert.ok(fnSrc.includes("sanitizePlanId(planId)"), "loadState should sanitize planId");
  });

  it("replaces leading dots to prevent .. traversal", () => {
    const fnIdx = src.indexOf("function sanitizePlanId");
    const fnSrc = src.slice(fnIdx, fnIdx + 200);
    assert.ok(fnSrc.includes("replace(/^"), "should have replace for leading chars");
    assert.ok(fnSrc.includes(".slice(0, 128)"), "should cap length");
  });
});

// ── Fix 2: taskEvidenceCapture.js — path traversal guard ──
describe("Batch15 Fix2: taskEvidenceCapture sanitizeId", () => {
  const src = ESM_SRC("workforce/taskEvidenceCapture.js");

  it("defines module-level sanitizeId helper", () => {
    const idx = src.indexOf("function sanitizeId(id)");
    assert.ok(idx >= 0, "sanitizeId should exist at module level");
    const window = src.slice(idx, idx + 300);
    assert.ok(window.includes("[^a-zA-Z0-9_.\\-]"), "should strip dangerous path chars");
    assert.ok(window.includes(".slice(0, 128)"), "should cap length at 128");
  });

  it("sanitizes planId and agentId in finish()", () => {
    const fnIdx = src.indexOf("async finish()");
    assert.ok(fnIdx >= 0, "finish() should exist");
    const fnSrc = src.slice(fnIdx, fnIdx + 600);
    assert.ok(fnSrc.includes("sanitizeId(planId)"), "finish should sanitize planId");
    assert.ok(fnSrc.includes("sanitizeId(agentId)"), "finish should sanitize agentId");
  });

  it("sanitizes in load() method", () => {
    const fnIdx = src.indexOf("async load(planId, agentId)");
    assert.ok(fnIdx >= 0, "load() should exist");
    const fnSrc = src.slice(fnIdx, fnIdx + 400);
    assert.ok(fnSrc.includes("sanitizeId(planId)"), "load should sanitize planId");
    assert.ok(fnSrc.includes("sanitizeId(agentId)"), "load should sanitize agentId");
  });

  it("sanitizes planId in getEvidenceChain()", () => {
    const fnIdx = src.indexOf("async getEvidenceChain(planId)");
    assert.ok(fnIdx >= 0, "getEvidenceChain should exist");
    const fnSrc = src.slice(fnIdx, fnIdx + 300);
    assert.ok(fnSrc.includes("sanitizeId(planId)"), "getEvidenceChain should sanitize planId");
  });

  it("has at least 5 sanitizeId call sites", () => {
    const count = (src.match(/sanitizeId\(/g) || []).length;
    assert.ok(count >= 5, `expected at least 5 sanitizeId calls, found ${count}`);
  });
});

// ── Fix 3: providerOnboardingService.js — API key leak ──
describe("Batch15 Fix3: getProvider API key redaction", () => {
  const src = ESM_SRC("providers/providerOnboardingService.js");

  it("destructures apiKey out before spreading", () => {
    const fnIdx = src.indexOf("async getProvider(providerId)");
    assert.ok(fnIdx >= 0, "getProvider should exist");
    const fnSrc = src.slice(fnIdx, fnIdx + 500);
    assert.ok(fnSrc.includes("const { apiKey"), "should destructure apiKey");
    assert.ok(fnSrc.includes("...safeProvider"), "should spread safe provider (no apiKey)");
  });

  it("also destructures secretKey", () => {
    const fnIdx = src.indexOf("async getProvider(providerId)");
    const fnSrc = src.slice(fnIdx, fnIdx + 500);
    assert.ok(fnSrc.includes("secretKey"), "should also destructure secretKey");
  });

  it("no raw ...provider spread in getProvider return", () => {
    const fnIdx = src.indexOf("async getProvider(providerId)");
    const fnSrc = src.slice(fnIdx, fnIdx + 500);
    assert.ok(!fnSrc.includes("...provider,"), "should not spread raw provider");
  });
});

// ── Fix 4: providerOnboardingService.js — session bypass ──
describe("Batch15 Fix4: activateProvider session enforcement", () => {
  const src = ESM_SRC("providers/providerOnboardingService.js");

  it("throws when no onboarding session exists", () => {
    assert.ok(src.includes("Cannot activate: no onboarding session found"),
      "should throw when session is null");
  });

  it("allPassed check only allows passed status", () => {
    const idx = src.indexOf("const allPassed = Object.values(steps).every");
    assert.ok(idx >= 0, "allPassed check should exist");
    const window = src.slice(idx, idx + 150);
    assert.ok(window.includes('"passed"'), "should check for passed status");
    assert.ok(!window.includes('"pending"'), "should NOT allow pending status");
  });

  it("session required check comes before session optional block", () => {
    const throwIdx = src.indexOf("Cannot activate: no onboarding session");
    const sessionBlockIdx = src.indexOf("if (session) {", throwIdx);
    assert.ok(throwIdx >= 0, "throw should exist");
    assert.ok(sessionBlockIdx > throwIdx, "session block should come after throw");
  });
});

// ── Fix 5: vectorProductionProbe.js — JSON.parse guard ──
describe("Batch15 Fix5: vectorProductionProbe JSON.parse guard", () => {
  const src = ESM_SRC("knowledge/vectorProductionProbe.js");

  it("wraps JSON.parse in try-catch", () => {
    const idx = src.indexOf("JSON.parse(textBody)");
    assert.ok(idx >= 0, "JSON.parse should exist");
    const window = src.slice(Math.max(0, idx - 100), idx + 300);
    assert.ok(window.includes("try {"), "should have try block before parse");
    assert.ok(window.includes("catch"), "should have catch block after parse");
  });

  it("provides contextual error message", () => {
    assert.ok(src.includes("non-JSON body"), "error should mention non-JSON");
    assert.ok(src.includes("textBody.slice(0, 200)"), "error should include body snippet");
  });
});

// ── Fix 6: sessionStore.js — atomic write ──
describe("Batch15 Fix6: sessionStore atomic write", () => {
  const src = ESM_SRC("agentic/sessionStore.js");

  it("writes to .tmp file first", () => {
    assert.ok(src.includes(".tmp"), "should use .tmp file");
    assert.ok(src.includes("tmpPath"), "should define tmpPath variable");
  });

  it("renames .tmp to final path atomically", () => {
    assert.ok(src.includes("renameAsync"), "should use renameAsync");
    assert.ok(src.includes("renameAsync(tmpPath, filePath)"), "should rename tmp to final");
  });

  it("imports rename from node:fs/promises", () => {
    assert.ok(src.includes("node:fs/promises"), "should import from node:fs/promises");
  });
});

// ── Fix 7: autoContext.js — bounded file read ──
describe("Batch15 Fix7: autoContext bounded file read", () => {
  const src = ESM_SRC("agentic/autoContext.js");

  it("checks file size before reading", () => {
    assert.ok(src.includes("fileStat"), "should use fileStat");
    assert.ok(src.includes("st.size"), "should check file size");
  });

  it("uses createReadStream for large files", () => {
    assert.ok(src.includes("createReadStream"), "should use createReadStream for large files");
    assert.ok(src.includes("MAX_FILE_READ_BYTES"), "should reference size limit");
  });

  it("still uses readFile for small files (fast path)", () => {
    const fnIdx = src.indexOf("async function readFileHead");
    assert.ok(fnIdx >= 0, "readFileHead should exist");
    const fnSrc = src.slice(fnIdx, fnIdx + 800);
    assert.ok(fnSrc.includes("await readFile(filePath"), "small files should use readFile");
  });
});

// ── Fix 8: enterpriseGovernanceService.js — JSON.parse guards ──
describe("Batch15 Fix8: enterpriseGovernanceService JSON.parse guards", () => {
  const src = ESM_SRC("enterprise/enterpriseGovernanceService.js");

  it("parseUsers wraps JSON.parse in try-catch", () => {
    assert.ok(src.includes("Failed to parse PME_ENTERPRISE_USERS_JSON"),
      "should have contextual error for env var parse");
    const fnIdx = src.indexOf("function parseUsers");
    assert.ok(fnIdx >= 0, "parseUsers should exist");
    const fnSrc = src.slice(fnIdx, fnIdx + 600);
    assert.ok(fnSrc.includes("try {"), "should have try block");
    assert.ok(fnSrc.includes("catch"), "should have catch block");
  });

  it("parseUsers returns empty array on parse failure", () => {
    const fnIdx = src.indexOf("function parseUsers");
    const fnSrc = src.slice(fnIdx, fnIdx + 600);
    assert.ok(fnSrc.includes("parsed = []"), "should default to empty array on failure");
  });

  it("loadStoredUsers wraps JSON.parse in try-catch", () => {
    assert.ok(src.includes("Failed to parse user store file"),
      "should have contextual error for file parse");
    const fnIdx = src.indexOf("function loadStoredUsers");
    assert.ok(fnIdx >= 0, "loadStoredUsers should exist");
    const fnSrc = src.slice(fnIdx, fnIdx + 500);
    assert.ok(fnSrc.includes("try {"), "should have try block");
    assert.ok(fnSrc.includes("return []"), "should return empty on failure");
  });

  it("no unguarded throw on invalid array type", () => {
    assert.ok(!src.includes('throw new Error("PME_ENTERPRISE_USERS_JSON must be an array.")'),
      "should not throw on non-array; should log and default to empty");
  });
});
