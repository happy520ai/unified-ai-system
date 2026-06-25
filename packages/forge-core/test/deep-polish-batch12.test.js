/**
 * Deep Polish Batch 12 - Tests for 10 critical fixes in forge-core
 *
 * 1. agent-pool: undefined context/state ReferenceError fix (lines 1491-1492)
 * 2. agent-pool: JSON.parse safety in #processQueue + #extractTaskFiles
 * 3. worker/base: JSON.parse safety in #gatherFiles
 * 4. worker/base: JSON.parse safety in #isAllowed
 * 5. worker/base: Command injection prevention in #autoLint (execFileSync)
 * 6. worker/base: Path traversal guard for ALL actions including read
 * 7. knowledge-graph: importState validate-before-clear (data-loss prevention)
 * 8. codebase-search: Path traversal guard in refreshFiles
 * 9. skillInstaller: GitHub token redaction + tempDir finally cleanup
 * 10. forge-routes: HTTP body size limit (1 MB DoS prevention)
 *
 * @module deep-polish-batch12
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __testDir = fileURLToPath(new URL(".", import.meta.url));
const FORGE_SRC = join(__testDir, "..", "src");

// ----------------------------------------------------------------
// 1. agent-pool: undefined context/state ReferenceError fix
// ----------------------------------------------------------------
describe("Batch12-1: agent-pool dead-letter-queue ReferenceError fix", () => {
  it("uses verifyResult local variable instead of undefined context", () => {
    const src = readFileSync(join(FORGE_SRC, "agent-pool", "index.js"), "utf-8");
    const dlqIdx = src.indexOf("deadLetterQueue.add");
    assert.ok(dlqIdx > 0, "deadLetterQueue.add should exist");
    const dlqArea = src.slice(dlqIdx, dlqIdx + 300);

    assert.ok(!dlqArea.includes("context?.verifyResult"), "Should NOT reference undefined context variable");
    assert.ok(dlqArea.includes("verifyResult"), "Should use local verifyResult variable");
  });

  it("uses empty array instead of undefined state.history", () => {
    const src = readFileSync(join(FORGE_SRC, "agent-pool", "index.js"), "utf-8");
    const dlqIdx = src.indexOf("deadLetterQueue.add");
    const dlqArea = src.slice(dlqIdx, dlqIdx + 300);

    assert.ok(!dlqArea.includes("state?.history"), "Should NOT reference undefined state variable");
    assert.ok(dlqArea.includes("strategyHistory: []"), "Should use empty array for strategyHistory");
  });
});

// ----------------------------------------------------------------
// 2. agent-pool: JSON.parse safety in processQueue + extractTaskFiles
// ----------------------------------------------------------------
describe("Batch12-2: agent-pool JSON.parse safety", () => {
  it("wraps JSON.parse in try-catch in processQueue allowed_files handling", () => {
    const src = readFileSync(join(FORGE_SRC, "agent-pool", "index.js"), "utf-8");
    const idx = src.indexOf("Expand allowedFiles for mutation tasks");
    assert.ok(idx > 0, "Should find allowedFiles expansion code");
    const area = src.slice(idx, idx + 400);

    assert.ok(area.includes("try"), "Should have try block around JSON.parse");
    assert.ok(area.includes("catch"), "Should have catch block for malformed JSON");
    assert.ok(area.includes("Array.isArray"), "Should validate result is an array");
  });

  it("wraps JSON.parse in try-catch in extractTaskFiles method", () => {
    const src = readFileSync(join(FORGE_SRC, "agent-pool", "index.js"), "utf-8");
    // Use the method definition pattern (not call sites) as anchor
    const idx = src.indexOf("extractTaskFiles(task) {");
    assert.ok(idx > 0, "Should find extractTaskFiles method definition");
    const area = src.slice(idx, idx + 600);

    assert.ok(area.includes("try"), "Should have try block around JSON.parse");
    assert.ok(area.includes("catch"), "Should have catch block for malformed JSON");
    assert.ok(area.includes("Array.isArray"), "Should validate result is an array");
  });

  it("does NOT have bare JSON.parse on allowed_files anywhere", () => {
    const src = readFileSync(join(FORGE_SRC, "agent-pool", "index.js"), "utf-8");
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('JSON.parse(task.allowed_files)') && line.includes('?')) {
        assert.fail(`Line ${i + 1} still has unsafe JSON.parse ternary: ${line.trim()}`);
      }
    }
  });
});

// ----------------------------------------------------------------
// 3. worker/base: JSON.parse safety in gatherFiles
// ----------------------------------------------------------------
describe("Batch12-3: worker/base gatherFiles JSON.parse safety", () => {
  it("wraps JSON.parse in try-catch with array validation", () => {
    const src = readFileSync(join(FORGE_SRC, "worker", "base.js"), "utf-8");
    // Use method definition as anchor with wide window
    const idx = src.indexOf("gatherFiles(projectRoot, allowedPatterns");
    assert.ok(idx > 0, "Should find gatherFiles method definition");
    const area = src.slice(idx, idx + 600);

    assert.ok(area.includes("try"), "Should have try block");
    assert.ok(area.includes("catch"), "Should have catch block");
    assert.ok(area.includes("Array.isArray(patterns)"), "Should validate patterns is array");
  });

  it("falls back to default glob pattern on parse failure", () => {
    const src = readFileSync(join(FORGE_SRC, "worker", "base.js"), "utf-8");
    const idx = src.indexOf("gatherFiles(projectRoot, allowedPatterns");
    assert.ok(idx > 0, "Should find gatherFiles method definition");
    const area = src.slice(idx, idx + 600);

    assert.ok(area.includes("['**/*']"), "Should fall back to default glob pattern");
  });
});

// ----------------------------------------------------------------
// 4. worker/base: JSON.parse safety in isAllowed
// ----------------------------------------------------------------
describe("Batch12-4: worker/base isAllowed JSON.parse safety", () => {
  it("wraps JSON.parse in try-catch with array validation", () => {
    const src = readFileSync(join(FORGE_SRC, "worker", "base.js"), "utf-8");
    // Use method definition signature (not call site) as anchor
    const idx = src.indexOf("isAllowed(filePath, patterns) {");
    assert.ok(idx > 0, "Should find isAllowed method definition");
    const area = src.slice(idx, idx + 600);

    assert.ok(area.includes("try"), "Should have try block");
    assert.ok(area.includes("catch"), "Should have catch block");
    assert.ok(area.includes("Array.isArray"), "Should validate result is array");
  });

  it("returns true (open policy) on parse failure", () => {
    const src = readFileSync(join(FORGE_SRC, "worker", "base.js"), "utf-8");
    const idx = src.indexOf("isAllowed(filePath, patterns) {");
    assert.ok(idx > 0, "Should find isAllowed method definition");
    const area = src.slice(idx, idx + 600);

    assert.ok(area.includes("return true"), "Should return true on config error");
  });
});

// ----------------------------------------------------------------
// 5. worker/base: Command injection prevention in autoLint
// ----------------------------------------------------------------
describe("Batch12-5: worker/base autoLint command injection prevention", () => {
  it("uses execFileSync instead of execSync", () => {
    const src = readFileSync(join(FORGE_SRC, "worker", "base.js"), "utf-8");
    const idx = src.indexOf("autoLint");
    assert.ok(idx > 0, "Should find autoLint method");
    const area = src.slice(idx, idx + 500);

    assert.ok(area.includes("execFileSync"), "Should use execFileSync (no shell interpretation)");
    assert.ok(!area.includes("execSync(\`"), "Should NOT use execSync with template literal (shell injection)");
  });

  it("passes eslint args as array, not string interpolation", () => {
    const src = readFileSync(join(FORGE_SRC, "worker", "base.js"), "utf-8");
    const idx = src.indexOf("autoLint");
    const area = src.slice(idx, idx + 500);

    assert.ok(area.includes("['eslint', '--fix', fullPath]"), "Should pass args as array");
  });
});

// ----------------------------------------------------------------
// 6. worker/base: Path traversal guard for ALL actions
// ----------------------------------------------------------------
describe("Batch12-6: worker/base path traversal guard for read actions", () => {
  it("blocks paths outside project root for all action types", () => {
    const src = readFileSync(join(FORGE_SRC, "worker", "base.js"), "utf-8");
    // Anchor on the unique error message
    const anchorIdx = src.indexOf("Path traversal blocked:");
    assert.ok(anchorIdx > 0, "Should find path traversal error message");
    // Look backward to include the method definition context
    const areaStart = Math.max(0, anchorIdx - 400);
    const area = src.slice(areaStart, anchorIdx + 200);

    assert.ok(area.includes("resolvedRoot"), "Should resolve project root");
    assert.ok(area.includes("startsWith"), "Should check path starts with project root");
    assert.ok(area.includes("Path traversal blocked"), "Should throw on traversal attempt");
  });

  it("checks path BEFORE the mutating-action-only restriction", () => {
    const src = readFileSync(join(FORGE_SRC, "worker", "base.js"), "utf-8");
    // Use the method definition as anchor
    const execIdx = src.indexOf("executeAction(action, projectRoot, task) {");
    assert.ok(execIdx > 0, "Should find executeAction method definition");
    const area = src.slice(execIdx, execIdx + 1000);

    const traversalIdx = area.indexOf("Path traversal");
    const mutatingIdx = area.indexOf("mutatingActions");
    assert.ok(traversalIdx > 0 && mutatingIdx > 0, "Both guards should exist");
    assert.ok(traversalIdx < mutatingIdx, "Path traversal check should come BEFORE mutating-action check");
  });
});

// ----------------------------------------------------------------
// 7. knowledge-graph: importState validate-before-clear
// ----------------------------------------------------------------
describe("Batch12-7: knowledge-graph importState validate-before-clear", () => {
  it("validates state object before calling clear()", () => {
    const src = readFileSync(join(FORGE_SRC, "knowledge-graph", "index.js"), "utf-8");
    const idx = src.indexOf("importState(state)");
    assert.ok(idx > 0, "Should find importState method");
    const area = src.slice(idx, idx + 400);

    const validateIdx = area.indexOf("Array.isArray(state.nodes)");
    const clearIdx = area.indexOf("this.clear()");
    assert.ok(validateIdx > 0, "Should validate state.nodes is array");
    assert.ok(clearIdx > 0, "Should call clear()");
    assert.ok(validateIdx < clearIdx, "Validation should come BEFORE clear (prevents data-loss)");
  });

  it("checks for valid edges array too", () => {
    const src = readFileSync(join(FORGE_SRC, "knowledge-graph", "index.js"), "utf-8");
    const idx = src.indexOf("importState(state)");
    const area = src.slice(idx, idx + 400);

    assert.ok(area.includes("Array.isArray(state.edges)"), "Should validate state.edges is array");
  });

  it("throws TypeError on invalid state", () => {
    const src = readFileSync(join(FORGE_SRC, "knowledge-graph", "index.js"), "utf-8");
    const idx = src.indexOf("importState(state)");
    const area = src.slice(idx, idx + 400);

    assert.ok(area.includes("throw new TypeError"), "Should throw TypeError on invalid input");
  });
});

// ----------------------------------------------------------------
// 8. codebase-search: Path traversal guard in refreshFiles
// ----------------------------------------------------------------
describe("Batch12-8: codebase-search path traversal guard in refreshFiles", () => {
  it("blocks path traversal in refreshFiles", () => {
    const src = readFileSync(join(FORGE_SRC, "codebase-search", "index.js"), "utf-8");
    // Anchor on the unique error message
    const anchorIdx = src.indexOf("path traversal blocked");
    assert.ok(anchorIdx > 0, "Should find path traversal guard code");
    const areaStart = Math.max(0, anchorIdx - 300);
    const area = src.slice(areaStart, anchorIdx + 200);

    assert.ok(area.includes("path traversal blocked"), "Should block traversal");
    assert.ok(area.includes("startsWith"), "Should check resolved path starts with project root");
  });

  it("imports resolve from node:path", () => {
    const src = readFileSync(join(FORGE_SRC, "codebase-search", "index.js"), "utf-8");
    assert.ok(src.includes("resolve") && src.includes("node:path"), "Should import resolve for path validation");
  });

  it("continues to next file on traversal attempt (not crash)", () => {
    const src = readFileSync(join(FORGE_SRC, "codebase-search", "index.js"), "utf-8");
    const anchorIdx = src.indexOf("path traversal blocked");
    assert.ok(anchorIdx > 0, "Should find path traversal guard code");
    // Look backward to capture errors.push (same line, before the string literal)
    const areaStart = Math.max(0, anchorIdx - 100);
    const area = src.slice(areaStart, anchorIdx + 200);

    assert.ok(area.includes("continue"), "Should continue to next file instead of crashing");
    assert.ok(area.includes("errors.push"), "Should record the traversal attempt as an error");
  });
});

// ----------------------------------------------------------------
// 9. skillInstaller: token redaction + tempDir finally cleanup
// ----------------------------------------------------------------
describe("Batch12-9: skillInstaller token redaction + tempDir cleanup", () => {
  it("redacts GitHub token from git clone error messages", () => {
    const src = readFileSync(join(FORGE_SRC, "skills", "skillInstaller.js"), "utf-8");
    assert.ok(src.includes("[REDACTED]"), "Should replace token with [REDACTED] in error messages");
    assert.ok(src.includes("err2.message.replace(token"), "Should actively replace token in error");
  });

  it("uses finally block for tempDir cleanup", () => {
    const src = readFileSync(join(FORGE_SRC, "skills", "skillInstaller.js"), "utf-8");
    assert.ok(src.includes("finally {"), "Should have finally block");

    const finallyIdx = src.indexOf("finally {");
    const rmInFinally = src.slice(finallyIdx, finallyIdx + 200);
    assert.ok(rmInFinally.includes("rm(tempDir"), "finally block should clean up tempDir");
  });

  it("validates skillPath against path traversal", () => {
    const src = readFileSync(join(FORGE_SRC, "skills", "skillInstaller.js"), "utf-8");
    assert.ok(src.includes("skillPath escapes install directory"), "Should block skillPath traversal");
    assert.ok(src.includes("resolvedSkillMd"), "Should resolve skillMd path for validation");
  });

  it("imports sep from node:path for traversal check", () => {
    const src = readFileSync(join(FORGE_SRC, "skills", "skillInstaller.js"), "utf-8");
    const importLine = src.split('\n').find(l => l.includes("node:path"));
    assert.ok(importLine?.includes("sep"), "Should import sep for path separator comparison");
  });
});

// ----------------------------------------------------------------
// 10. forge-routes: HTTP body size limit
// ----------------------------------------------------------------
describe("Batch12-10: forge-routes HTTP body size limit", () => {
  it("enforces 1 MB maximum body size", () => {
    const src = readFileSync(join(FORGE_SRC, "integration", "forge-routes.js"), "utf-8");
    const idx = src.indexOf("readBody");
    assert.ok(idx > 0, "Should find readBody function");
    const area = src.slice(idx, idx + 600);

    assert.ok(area.includes("MAX_BODY"), "Should define MAX_BODY constant");
    assert.ok(area.includes("1024 * 1024") || area.includes("1048576"), "MAX_BODY should be 1 MB");
  });

  it("destroys request and rejects when body exceeds limit", () => {
    const src = readFileSync(join(FORGE_SRC, "integration", "forge-routes.js"), "utf-8");
    const idx = src.indexOf("readBody");
    const area = src.slice(idx, idx + 600);

    assert.ok(area.includes("req.destroy()"), "Should destroy the request on oversized body");
    assert.ok(area.includes("too large") || area.includes("Body too large"), "Should provide clear error message");
  });

  it("tracks accumulated size across chunks", () => {
    const src = readFileSync(join(FORGE_SRC, "integration", "forge-routes.js"), "utf-8");
    const idx = src.indexOf("readBody");
    const area = src.slice(idx, idx + 600);

    assert.ok(area.includes("size +=") || area.includes("size += chunk.length"), "Should accumulate size across chunks");
    assert.ok(area.includes("size > MAX_BODY"), "Should check size against limit");
  });
});
