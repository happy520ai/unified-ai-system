// Deep Polish Batch 14 — 8 fixes, 8 test suites
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

// ── Fix 1: generateStream SSRF guard ──
describe("Batch14 Fix1: generateStream SSRF guard", () => {
  const src = ESM_SRC("providers/httpLlmProviderAdapter.js");

  it("has SSRF guard in generateStream method", () => {
    const gsIdx = src.indexOf("generateStream(providerRequest)");
    assert.ok(gsIdx >= 0, "generateStream method not found");
    // Look within 2000 chars of the method start
    const window = src.slice(gsIdx, gsIdx + 2000);
    assert.ok(window.includes("isPrivateOrReservedUrl"), "SSRF guard not found in generateStream");
    assert.ok(window.includes("SSRF blocked"), "SSRF block message not found in generateStream");
  });

  it("SSRF guard appears at least twice (once per fetch call)", () => {
    const guardCount = (src.match(/isPrivateOrReservedUrl\(/g) || []).length;
    // definition + _generateOnce guard + generateStream guard = at least 3
    assert.ok(guardCount >= 3, `expected at least 3 isPrivateOrReservedUrl calls, found ${guardCount}`);
  });

  it("SSRF guard in generateStream is before the fetch call", () => {
    const gsIdx = src.indexOf("generateStream(providerRequest)");
    const section = src.slice(gsIdx, gsIdx + 2000);
    const guardIdx = section.indexOf("isPrivateOrReservedUrl");
    const fetchIdx = section.indexOf("response = await fetch");
    assert.ok(guardIdx >= 0, "guard not found in generateStream");
    assert.ok(fetchIdx >= 0, "fetch not found in generateStream");
    assert.ok(guardIdx < fetchIdx, "SSRF guard should be before fetch call");
  });
});

// ── Fix 2: mcpBridge stdio buffer cap ──
describe("Batch14 Fix2: mcpBridge stdio buffer cap", () => {
  const src = ESM_SRC("claude-code-patterns/mcpBridge.js");

  it("defines MAX_STDIO_BUFFER constant", () => {
    const idx = src.indexOf("MAX_STDIO_BUFFER");
    assert.ok(idx >= 0, "MAX_STDIO_BUFFER not found");
    const line = src.slice(idx, src.indexOf("\n", idx));
    assert.ok(
      line.includes("1_048_576") || line.includes("1048576"),
      "should be 1MB"
    );
  });

  it("checks buffer.length against MAX_STDIO_BUFFER", () => {
    assert.ok(
      src.includes("buffer.length > MAX_STDIO_BUFFER"),
      "buffer length check not found"
    );
  });

  it("emits error and resets buffer when exceeded", () => {
    const idx = src.indexOf("buffer.length > MAX_STDIO_BUFFER");
    assert.ok(idx >= 0, "buffer check not found");
    const window = src.slice(idx, idx + 300);
    assert.ok(window.includes('emit("error"'), "should emit error event");
    assert.ok(window.includes('buffer = ""'), "should reset buffer");
  });
});

// ── Fix 3: selfEvolutionPipeline rollback path traversal ──
describe("Batch14 Fix3: selfEvolutionPipeline rollback path traversal guard", () => {
  const src = ESM_SRC("capabilities/selfEvolutionPipeline.js");

  it("sanitizes capabilityId in rollback code path", () => {
    // Find the join with generatedCodeDir
    const idx = src.indexOf("join(generatedCodeDir, sanitizeCapabilityId");
    assert.ok(idx >= 0, "sanitizeCapabilityId not used with generatedCodeDir");
  });

  it("sanitizeCapabilityId is used at least 4 times (3 original + 1 rollback)", () => {
    const count = (src.match(/sanitizeCapabilityId\(/g) || []).length;
    // function definition + 3 original usages + 1 rollback = at least 4 calls (excluding the definition)
    assert.ok(count >= 4, `expected at least 4 sanitizeCapabilityId calls, found ${count}`);
  });
});

// ── Fix 4: agenticCodingLoop checkpoint size limit ──
describe("Batch14 Fix4: agenticCodingLoop checkpoint size limit", () => {
  const src = ESM_SRC("agentic/agenticCodingLoop.js");

  it("defines MAX_CHECKPOINT_SIZE constant (10MB)", () => {
    const idx = src.indexOf("MAX_CHECKPOINT_SIZE");
    assert.ok(idx >= 0, "MAX_CHECKPOINT_SIZE not found");
    const line = src.slice(idx, src.indexOf("\n", idx));
    assert.ok(
      line.includes("10 * 1024 * 1024") || line.includes("10485760"),
      "should be 10MB"
    );
  });

  it("uses statSync to check file size before reading", () => {
    assert.ok(src.includes("statSync"), "statSync not found");
    assert.ok(src.includes("_statSync(checkpointPath)"), "should stat the checkpoint file");
  });

  it("rejects checkpoint if file too large", () => {
    assert.ok(src.includes("checkpoint rejected"), "should log rejection");
    assert.ok(src.includes("File too large"), "should mention file too large");
  });

  it("wraps JSON.parse in an else block after size check", () => {
    const idx = src.indexOf("MAX_CHECKPOINT_SIZE");
    const window = src.slice(idx, idx + 400);
    assert.ok(window.includes("} else {"), "should have else block for safe path");
    assert.ok(window.includes("JSON.parse"), "should parse JSON in else block");
  });
});

// ── Fix 5: workforceControlledExecutor timer cleanup ──
describe("Batch14 Fix5: workforceControlledExecutor timer cleanup", () => {
  const src = ESM_SRC("workforce/workforceControlledExecutor.js");

  it("declares _timeoutTimer variable", () => {
    assert.ok(src.includes("_timeoutTimer"), "_timeoutTimer variable not found");
  });

  it("clears timer in .finally() on the executeAllRoles promise", () => {
    assert.ok(
      src.includes("finally(() => clearTimeout(_timeoutTimer))"),
      "finally clearTimeout not found"
    );
  });

  it("assigns timer to _timeoutTimer in setTimeout", () => {
    assert.ok(
      src.includes("_timeoutTimer = setTimeout"),
      "timer assignment not found"
    );
  });
});

// ── Fix 6: webSocketServer connection cap ──
describe("Batch14 Fix6: webSocketServer connection cap", () => {
  const src = ESM_SRC("http/webSocketServer.js");

  it("defines MAX_WS_CONNECTIONS constant", () => {
    const idx = src.indexOf("MAX_WS_CONNECTIONS");
    assert.ok(idx >= 0, "MAX_WS_CONNECTIONS not found");
    const line = src.slice(idx, src.indexOf("\n", idx));
    assert.ok(line.includes("100"), "should be 100");
  });

  it("checks connections.size against MAX_WS_CONNECTIONS", () => {
    assert.ok(
      src.includes("connections.size >= MAX_WS_CONNECTIONS"),
      "connection cap check not found"
    );
  });

  it("sends 503 and destroys socket when limit reached", () => {
    const idx = src.indexOf("connections.size >= MAX_WS_CONNECTIONS");
    assert.ok(idx >= 0, "cap check not found");
    const window = src.slice(idx, idx + 300);
    assert.ok(window.includes("503"), "should send 503 status");
    assert.ok(window.includes("socket.destroy"), "should destroy socket");
  });
});

// ── Fix 7: index.js unhandledRejection + shutdown timeout ──
describe("Batch14 Fix7: unhandledRejection handler + shutdown timeout", () => {
  const src = ESM_SRC("index.js");

  it("registers unhandledRejection handler", () => {
    assert.ok(
      src.includes('process.on("unhandledRejection"'),
      "unhandledRejection handler not found"
    );
  });

  it("logs reason instead of crashing", () => {
    const idx = src.indexOf("unhandledRejection");
    const window = src.slice(idx, idx + 300);
    assert.ok(window.includes("console.error"), "should log the rejection");
  });

  it("shutdown uses forced exit timeout", () => {
    assert.ok(src.includes("forceTimer"), "forceTimer not found");
    assert.ok(src.includes("forceTimer.unref"), "timer should be unref'd");
  });

  it("forced shutdown timeout is reasonable (10s)", () => {
    const idx = src.indexOf("forceTimer = setTimeout");
    assert.ok(idx >= 0, "forceTimer setTimeout not found");
    const window = src.slice(idx, idx + 200);
    assert.ok(
      window.includes("10_000") || window.includes("10000"),
      "should be 10 seconds"
    );
  });
});

// ── Fix 8: executionApprovalGate atomic write ──
describe("Batch14 Fix8: executionApprovalGate atomic write", () => {
  const src = ESM_SRC("workforce/executionApprovalGate.js");

  it("writes to .tmp file first", () => {
    assert.ok(src.includes('.tmp"'), "should write to .tmp file");
    assert.ok(src.includes("tmpPath"), "should use tmpPath variable");
  });

  it("uses renameAsync for atomic rename", () => {
    assert.ok(src.includes("renameAsync"), "renameAsync not found");
    assert.ok(
      src.includes("renameAsync(tmpPath, storePath)"),
      "should rename tmp to final path"
    );
  });

  it("imports renameAsync from node:fs/promises", () => {
    assert.ok(
      src.includes("node:fs/promises"),
      "should import from node:fs/promises"
    );
  });
});
