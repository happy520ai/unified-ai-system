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
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createSourceReader } from "./helpers/source-closure.js";

const __testDir = fileURLToPath(new URL(".", import.meta.url));
const FORGE_SRC = join(__testDir, "..", "src");
const readFileSync = createSourceReader(FORGE_SRC);

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
  it("routes executable eslint configuration through FULL isolation", () => {
    const src = readFileSync(join(FORGE_SRC, "worker", "base-syntax-utils.js"), "utf-8");
    const idx = src.indexOf("export async function autoLint");
    assert.ok(idx > 0, "Should find autoLint method");
    const area = src.slice(idx, idx + 1800);

    assert.ok(area.includes("sandboxExecutor.execute"), "Should use the sandbox executor");
    assert.ok(area.includes("level: 'full'"), "Should require FULL isolation");
    assert.ok(area.includes("workspaceMode: 'rw'"), "Should explicitly scope the writable workspace mount");
    assert.ok(!area.includes("node:child_process"), "Should not invoke project eslint on the host");
  });

  it("quotes the validated relative path inside the container shell", () => {
    const src = readFileSync(join(FORGE_SRC, "worker", "base-syntax-utils.js"), "utf-8");
    const idx = src.indexOf("export async function autoLint");
    const area = src.slice(idx, idx + 1800);

    assert.ok(area.includes("quotePosixShellArg(containerPath)"), "Should quote the path as one shell argument");
    assert.ok(area.includes("npx --no-install eslint --fix --"), "Should prohibit package download and terminate eslint flags");
  });
});

// ----------------------------------------------------------------
// 6. worker/base: Path traversal guard for ALL actions
// ----------------------------------------------------------------
describe("Batch12-6: worker/base path traversal guard for read actions", () => {
  it("canonically blocks outside paths and symlink or junction components", () => {
    const src = readFileSync(join(FORGE_SRC, "worker", "base-action-exec.js"), "utf-8");
    const guardIdx = src.indexOf("export async function resolveActionPath");
    assert.ok(guardIdx > 0, "Should find canonical action-path guard");
    const area = src.slice(guardIdx, guardIdx + 2200);

    assert.ok(area.includes("realpath(resolve(projectRoot))"), "Should canonicalize the project root");
    assert.ok(area.includes("isWithinRoot"), "Should enforce canonical root containment");
    assert.ok(area.includes("lstat"), "Should inspect every existing path component");
    assert.ok(area.includes("isSymbolicLink"), "Should reject symlinks and Windows junctions");
    assert.ok(area.includes("Path traversal blocked"), "Should throw on traversal attempt");
  });

  it("checks path BEFORE the mutating-action-only restriction", () => {
    const src = readFileSync(join(FORGE_SRC, "worker", "base-action-exec.js"), "utf-8");
    // Governed and legacy actions now share prepareActionPath; validate the
    // canonical guard ordering at that single pre-execution boundary.
    const execIdx = src.indexOf("async function prepareActionPath(");
    assert.ok(execIdx > 0, "Should find shared action preparation boundary");
    const area = src.slice(execIdx, execIdx + 1600);

    const traversalIdx = area.indexOf("resolveActionPath(projectRoot");
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
