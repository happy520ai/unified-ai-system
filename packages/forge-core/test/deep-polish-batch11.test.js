/**
 * Deep Polish Batch 11 — Tests for 8 critical fixes
 *
 * 1. agenticCodingLoop checkpoint resume path validation (arbitrary file read prevention)
 * 2. httpServer writeSseHeaders writableEnded/headersSent guard
 * 3. connectionPool socket timeout + URL parse safety
 * 4. mcpBridge stdin error handling + SIGKILL timer cleanup
 * 5. agentToolRegistry code_format/generate_test/ast_edit path validation
 * 6. enterpriseOpsService backup JSON.parse crash guard
 * 7. worktreeIsolation branch name sanitization
 * 8. userExperienceService auth timingSafeEqual
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Resolve source paths via import.meta.url for reliable cross-platform behavior
const __testDir = fileURLToPath(new URL(".", import.meta.url));
const SRC_ROOT = join(__testDir, "..", "..", "..", "apps", "ai-gateway-service", "src");
// For dynamic import() on Windows, must use file:// URL
const ESM_SRC = pathToFileURL(SRC_ROOT).href;

// ─── 1. Checkpoint resume path validation ──────────────────────────

describe("Batch11-1: agenticCodingLoop checkpoint resume path validation", () => {
  it("validates checkpoint path against working directory", () => {
    const src = readFileSync(join(SRC_ROOT, "agentic/agenticCodingLoop.js"), "utf-8");
    const cpStart = src.indexOf("resumeFromCheckpoint", src.indexOf("async function execute("));
    assert.ok(cpStart > 0, "Checkpoint resume code should exist in execute()");
    const cpArea = src.slice(cpStart, cpStart + 1400);

    assert.ok(cpArea.includes("checkpointPath"), "Should resolve checkpoint path");
    assert.ok(cpArea.includes("checkpointDir"), "Should resolve checkpoint directory");
    assert.ok(cpArea.includes("startsWith"), "Should validate path is within allowed directory");
  });

  it("rejects paths outside working directory", () => {
    const src = readFileSync(join(SRC_ROOT, "agentic/agenticCodingLoop.js"), "utf-8");
    const cpStart = src.indexOf("resumeFromCheckpoint", src.indexOf("async function execute("));
    const cpArea = src.slice(cpStart, cpStart + 1400);

    assert.ok(cpArea.includes("checkpoint path rejected"), "Should log rejection when path is outside working dir");
  });

  it("uses resolve to normalize paths before comparison", () => {
    const src = readFileSync(join(SRC_ROOT, "agentic/agenticCodingLoop.js"), "utf-8");
    const cpStart = src.indexOf("resumeFromCheckpoint", src.indexOf("async function execute("));
    const cpArea = src.slice(cpStart, cpStart + 1400);

    assert.ok(cpArea.includes("resolvePath"), "Should use path.resolve for normalization");
    assert.ok(cpArea.includes("workingDirectory"), "Should use workingDirectory as the allowed base");
  });

  it("only reads file when path validation passes (else branch)", () => {
    const src = readFileSync(join(SRC_ROOT, "agentic/agenticCodingLoop.js"), "utf-8");
    const cpStart = src.indexOf("resumeFromCheckpoint", src.indexOf("async function execute("));
    const cpArea = src.slice(cpStart, cpStart + 1400);

    // The readFileSync should be inside an else block (after the path check)
    const rejectIdx = cpArea.indexOf("checkpoint path rejected");
    const readIdx = cpArea.indexOf("readFileSync(checkpointPath");
    assert.ok(rejectIdx > 0, "Should have path rejection code");
    assert.ok(readIdx > rejectIdx, "readFileSync should come AFTER path validation");
  });
});

// ─── 2. writeSseHeaders guard ──────────────────────────────────────

describe("Batch11-2: writeSseHeaders writableEnded/headersSent guard", () => {
  it("checks writableEnded before writing SSE headers", () => {
    const src = readFileSync(join(SRC_ROOT, "http/httpServer.js"), "utf-8");
    const fnStart = src.indexOf("function writeSseHeaders(");
    assert.ok(fnStart > 0, "writeSseHeaders function should exist");
    const fnSrc = src.slice(fnStart, fnStart + 300);

    assert.ok(fnSrc.includes("writableEnded"), "Should check writableEnded");
  });

  it("checks headersSent before writing SSE headers", () => {
    const src = readFileSync(join(SRC_ROOT, "http/httpServer.js"), "utf-8");
    const fnStart = src.indexOf("function writeSseHeaders(");
    const fnSrc = src.slice(fnStart, fnStart + 300);

    assert.ok(fnSrc.includes("headersSent"), "Should check headersSent");
  });

  it("returns early when response is already finalized", () => {
    const src = readFileSync(join(SRC_ROOT, "http/httpServer.js"), "utf-8");
    const fnStart = src.indexOf("function writeSseHeaders(");
    const fnSrc = src.slice(fnStart, fnStart + 300);

    // Guard should come before writeHead
    const guardIdx = fnSrc.indexOf("return");
    const writeHeadIdx = fnSrc.indexOf("writeHead");
    assert.ok(guardIdx > 0, "Should have a return guard");
    assert.ok(writeHeadIdx > 0, "Should have writeHead call");
    assert.ok(guardIdx < writeHeadIdx, "Guard should come BEFORE writeHead");
  });

  it("all three response writers (writeJson, writeHtml, writeSseHeaders) have guards", () => {
    const src = readFileSync(join(SRC_ROOT, "http/httpServer.js"), "utf-8");

    // writeJson guard
    const jsonStart = src.indexOf("function writeJson(");
    const jsonSrc = src.slice(jsonStart, jsonStart + 200);
    assert.ok(jsonSrc.includes("writableEnded") || jsonSrc.includes("headersSent"), "writeJson should have guard");

    // writeHtml guard
    const htmlStart = src.indexOf("function writeHtml(");
    const htmlSrc = src.slice(htmlStart, htmlStart + 200);
    assert.ok(htmlSrc.includes("writableEnded") || htmlSrc.includes("headersSent"), "writeHtml should have guard");

    // writeSseHeaders guard
    const sseStart = src.indexOf("function writeSseHeaders(");
    const sseSrc = src.slice(sseStart, sseStart + 200);
    assert.ok(sseSrc.includes("writableEnded") || sseSrc.includes("headersSent"), "writeSseHeaders should have guard");
  });
});

// ─── 3. connectionPool timeout + URL safety ────────────────────────

describe("Batch11-3: connectionPool socket timeout + URL parse safety", () => {
  it("sets timeout option on agent creation", () => {
    const src = readFileSync(join(SRC_ROOT, "http/connectionPool.js"), "utf-8");

    assert.ok(src.includes("timeout:"), "Agent should have timeout option");
    assert.ok(src.includes("60_000"), "Default timeout should be 60 seconds");
  });

  it("wraps new URL() in try-catch for malformed baseUrl", () => {
    const src = readFileSync(join(SRC_ROOT, "http/connectionPool.js"), "utf-8");
    const fnStart = src.indexOf("function getOrCreateAgent(");
    const fnSrc = src.slice(fnStart, fnStart + 400);

    assert.ok(fnSrc.includes("try {"), "Should have try block around URL parsing");
    assert.ok(fnSrc.includes("catch"), "Should have catch for invalid URLs");
    assert.ok(fnSrc.includes("return undefined"), "Should return undefined for invalid URLs");
  });

  it("timeout value is configurable via options parameter", () => {
    const src = readFileSync(join(SRC_ROOT, "http/connectionPool.js"), "utf-8");

    assert.ok(src.includes("options.timeout"), "Should allow timeout to be configured via options");
  });
});

// ─── 4. mcpBridge stdin error + timer cleanup ──────────────────────

describe("Batch11-4: mcpBridge stdin error handling + SIGKILL timer cleanup", () => {
  it("attaches error handler to process.stdin", () => {
    const src = readFileSync(join(SRC_ROOT, "claude-code-patterns/mcpBridge.js"), "utf-8");
    const stdioStart = src.indexOf("createStdioTransport");
    const stdioSrc = src.slice(stdioStart, stdioStart + 2500);

    assert.ok(stdioSrc.includes('process.stdin.on("error"'), "Should attach error handler to stdin");
  });

  it("stdin error handler sets connected to false", () => {
    const src = readFileSync(join(SRC_ROOT, "claude-code-patterns/mcpBridge.js"), "utf-8");
    const stdioStart = src.indexOf("createStdioTransport");
    const stdioSrc = src.slice(stdioStart, stdioStart + 2500);

    // The stdin error handler should reset connected state
    const stdinErrIdx = stdioSrc.indexOf('process.stdin.on("error"');
    const stdinHandler = stdioSrc.slice(stdinErrIdx, stdinErrIdx + 100);
    assert.ok(stdinHandler.includes("connected = false"), "stdin error handler should set connected to false");
  });

  it("SIGKILL timer is stored in a variable for cleanup", () => {
    const src = readFileSync(join(SRC_ROOT, "claude-code-patterns/mcpBridge.js"), "utf-8");
    const stdioStart = src.indexOf("createStdioTransport");
    const stdioSrc = src.slice(stdioStart, stdioStart + 2500);

    assert.ok(stdioSrc.includes("_forceKillTimer"), "Should store SIGKILL timer in a variable");
  });

  it("clears previous SIGKILL timer before creating new one", () => {
    const src = readFileSync(join(SRC_ROOT, "claude-code-patterns/mcpBridge.js"), "utf-8");
    const disconnectStart = src.indexOf("disconnect() {");
    const disconnectSrc = src.slice(disconnectStart, disconnectStart + 400);

    assert.ok(disconnectSrc.includes("clearTimeout"), "Should clear previous timer before creating new one");
    assert.ok(disconnectSrc.includes("_forceKillTimer"), "Should reference the timer variable");
  });
});

// ─── 5. Tool path validation ───────────────────────────────────────

describe("Batch11-5: code_format/generate_test/ast_edit path validation", () => {
  it("code_format validates file path before write", () => {
    const src = readFileSync(join(SRC_ROOT, "claude-code-patterns/agentToolRegistry.js"), "utf-8");
    const cfStart = src.indexOf('name: "code_format"');
    assert.ok(cfStart > 0, "code_format tool should exist");
    const cfSrc = src.slice(cfStart, cfStart + 1200);

    assert.ok(cfSrc.includes("validateFilePath"), "code_format should call validateFilePath");
    assert.ok(cfSrc.includes("allowWrite: true"), "Should pass allowWrite option for write operations");
  });

  it("generate_test validates both source and test paths", () => {
    const src = readFileSync(join(SRC_ROOT, "claude-code-patterns/agentToolRegistry.js"), "utf-8");
    const gtStart = src.indexOf('name: "generate_test"');
    assert.ok(gtStart > 0, "generate_test tool should exist");
    const gtSrc = src.slice(gtStart, gtStart + 1600);

    assert.ok(gtSrc.includes("validateFilePath"), "generate_test should call validateFilePath");
    // Should validate both source_path and test_path
    const validateCount = (gtSrc.match(/validateFilePath/g) || []).length;
    assert.ok(validateCount >= 2, `Should validate at least 2 paths (source + test), found ${validateCount}`);
  });

  it("ast_edit validates file path before modification", () => {
    const src = readFileSync(join(SRC_ROOT, "claude-code-patterns/agentToolRegistry.js"), "utf-8");
    const implStart = src.indexOf("function astEditToolImpl");
    assert.ok(implStart > 0, "astEditToolImpl function should exist");
    const implSrc = src.slice(implStart, implStart + 600);

    assert.ok(implSrc.includes("validateFilePath"), "ast_edit should call validateFilePath");
    assert.ok(implSrc.includes("allowWrite: true"), "Should pass allowWrite for write operations");
  });

  it("path validation returns error on failure", () => {
    const src = readFileSync(join(SRC_ROOT, "claude-code-patterns/agentToolRegistry.js"), "utf-8");
    const cfStart = src.indexOf('name: "code_format"');
    const cfSrc = src.slice(cfStart, cfStart + 1200);

    assert.ok(cfSrc.includes("validation.safe"), "Should check validation.safe property");
    assert.ok(cfSrc.includes("validation.reason"), "Should include validation reason in error");
  });
});

// ─── 6. Backup JSON.parse crash guard ──────────────────────────────

describe("Batch11-6: enterpriseOpsService backup JSON.parse crash guard", () => {
  it("wraps audit JSON.parse in try-catch", () => {
    const src = readFileSync(join(SRC_ROOT, "enterprise/enterpriseOpsService.js"), "utf-8");
    const backupStart = src.indexOf("createBackup");
    assert.ok(backupStart > 0, "createBackup function should exist");
    const backupSrc = src.slice(backupStart, backupStart + 800);

    // Should have try-catch around JSON.parse
    assert.ok(backupSrc.includes("try {"), "Should have try block around JSON.parse");
    assert.ok(backupSrc.includes("catch"), "Should have catch block for parse errors");
  });

  it("defaults to empty array on parse failure", () => {
    const src = readFileSync(join(SRC_ROOT, "enterprise/enterpriseOpsService.js"), "utf-8");
    const backupStart = src.indexOf("createBackup");
    const backupSrc = src.slice(backupStart, backupStart + 800);

    assert.ok(backupSrc.includes("auditEntries = []"), "Should default to empty array on parse failure");
  });

  it("still parses audit content on success", () => {
    const src = readFileSync(join(SRC_ROOT, "enterprise/enterpriseOpsService.js"), "utf-8");
    const backupStart = src.indexOf("createBackup");
    const backupSrc = src.slice(backupStart, backupStart + 800);

    assert.ok(backupSrc.includes("JSON.parse(auditExport.content"), "Should still parse audit content normally");
  });
});

// ─── 7. Branch name sanitization ───────────────────────────────────

describe("Batch11-7: worktreeIsolation branch name sanitization", () => {
  it("sanitizes planId before using in branch name", () => {
    const src = readFileSync(join(SRC_ROOT, "workforce/worktreeIsolation.js"), "utf-8");

    assert.ok(src.includes("sanitizedPlanId"), "Should create a sanitized version of planId");
  });

  it("strips unsafe characters from planId", () => {
    const src = readFileSync(join(SRC_ROOT, "workforce/worktreeIsolation.js"), "utf-8");
    const branchArea = src.slice(src.indexOf("sanitizedPlanId") - 100, src.indexOf("sanitizedPlanId") + 200);

    // Should use replace with a regex that strips unsafe chars
    assert.ok(branchArea.includes(".replace("), "Should use replace to sanitize");
    assert.ok(branchArea.includes("[^a-zA-Z0-9_-]"), "Should strip characters that aren't alphanumeric, dash, or underscore");
  });

  it("limits planId length to prevent excessively long branch names", () => {
    const src = readFileSync(join(SRC_ROOT, "workforce/worktreeIsolation.js"), "utf-8");
    const branchArea = src.slice(src.indexOf("sanitizedPlanId") - 100, src.indexOf("sanitizedPlanId") + 200);

    assert.ok(branchArea.includes(".slice(0,"), "Should limit planId length");
  });

  it("uses sanitized planId in branch name construction", () => {
    const src = readFileSync(join(SRC_ROOT, "workforce/worktreeIsolation.js"), "utf-8");

    assert.ok(src.includes("workforce/${sanitizedPlanId}"), "Branch name should use sanitizedPlanId, not raw planId");
  });
});

// ─── 8. timingSafeEqual auth ───────────────────────────────────────

describe("Batch11-8: userExperienceService auth uses timingSafeEqual", () => {
  it("imports timingSafeEqual from node:crypto", () => {
    const src = readFileSync(join(SRC_ROOT, "capabilities/userExperienceService.js"), "utf-8");
    const fnStart = src.indexOf("function isAuthorized");
    assert.ok(fnStart > 0, "isAuthorized function should exist");
    const fnSrc = src.slice(fnStart, fnStart + 600);

    assert.ok(fnSrc.includes("timingSafeEqual"), "Should use timingSafeEqual for comparison");
  });

  it("no longer uses === for token comparison", () => {
    const src = readFileSync(join(SRC_ROOT, "capabilities/userExperienceService.js"), "utf-8");
    const fnStart = src.indexOf("function isAuthorized");
    const fnEnd = src.indexOf("}", src.indexOf("return safeCompare", fnStart));
    const fnSrc = src.slice(fnStart, fnEnd + 1);

    // Should NOT have direct === comparison with expectedToken
    assert.ok(!fnSrc.includes("headerToken === expectedToken"), "Must NOT use === for token comparison");
    assert.ok(!fnSrc.includes("bearer === expectedToken"), "Must NOT use === for bearer comparison");
  });

  it("compares token lengths before timingSafeEqual (prevents crash on mismatch)", () => {
    const src = readFileSync(join(SRC_ROOT, "capabilities/userExperienceService.js"), "utf-8");
    const fnStart = src.indexOf("function isAuthorized");
    const fnSrc = src.slice(fnStart, fnStart + 600);

    assert.ok(fnSrc.includes(".length !==") || fnSrc.includes(".length =="), "Should check lengths before timingSafeEqual");
  });

  it("uses Buffer.from for comparison inputs", () => {
    const src = readFileSync(join(SRC_ROOT, "capabilities/userExperienceService.js"), "utf-8");
    const fnStart = src.indexOf("function isAuthorized");
    const fnSrc = src.slice(fnStart, fnStart + 600);

    assert.ok(fnSrc.includes("Buffer.from("), "Should convert strings to Buffers for timingSafeEqual");
  });

  it("handles non-string inputs safely", () => {
    const src = readFileSync(join(SRC_ROOT, "capabilities/userExperienceService.js"), "utf-8");
    const fnStart = src.indexOf("function isAuthorized");
    const fnSrc = src.slice(fnStart, fnStart + 600);

    assert.ok(fnSrc.includes('typeof a !== "string"') || fnSrc.includes("typeof a !="), "Should type-check inputs");
    assert.ok(fnSrc.includes("return false"), "Should return false for invalid inputs");
  });
});
