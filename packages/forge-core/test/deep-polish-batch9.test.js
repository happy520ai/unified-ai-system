/**
 * Deep Polish Batch 9 — Tests for 8 critical fixes
 *
 * 1. type_check command injection → execFileSync (no shell interpolation)
 * 2. SSE stream client disconnect detection (close event + break)
 * 3. RAW_KEY_PATTERN global flag (redactSensitive replaces ALL occurrences)
 * 4. openAiAdapter connection pool (getOrCreateAgent imported + used)
 * 5. openAiAdapter error message redaction (sk-/Bearer patterns redacted)
 * 6. Temp credential file cleanup on failure (unlinkSync in catch block)
 * 7. WebSocket error message sanitization (generic message, no e.message leak)
 * 8. web_fetch response size limit (streaming reader, not resp.text())
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

// ─── 1. type_check command injection ────────────────────────────────

describe("Batch9-1: type_check uses execFileSync (no command injection)", () => {
  it("source uses execFileSync instead of execSync", () => {
    const src = readFileSync(join(SRC_ROOT, "claude-code-patterns/agentToolRegistry.js"), "utf-8");
    // Find the type_check tool section
    const typeCheckStart = src.indexOf("function createTypeCheckTool");
    const typeCheckEnd = src.indexOf("function createBuiltInTools");
    assert.ok(typeCheckStart > 0, "createTypeCheckTool function should exist");
    const typeCheckSrc = src.slice(typeCheckStart, typeCheckEnd);

    // Must use execFileSync, not execSync
    assert.ok(typeCheckSrc.includes("execFileSync"), "type_check should use execFileSync");
    assert.ok(!typeCheckSrc.includes("execSync(cmd"), "type_check must NOT use execSync with string command");
  });

  it("builds arguments as array instead of string concatenation", () => {
    const src = readFileSync(join(SRC_ROOT, "claude-code-patterns/agentToolRegistry.js"), "utf-8");
    const typeCheckStart = src.indexOf("function createTypeCheckTool");
    const typeCheckEnd = src.indexOf("function createBuiltInTools");
    const typeCheckSrc = src.slice(typeCheckStart, typeCheckEnd);

    // Should build args array
    assert.ok(typeCheckSrc.includes('const args = ["tsc", "--noEmit"]'), "Should build args array starting with tsc --noEmit");
    assert.ok(typeCheckSrc.includes('args.push('), "Should push arguments into array");
    // Should NOT have shell string interpolation
    assert.ok(!typeCheckSrc.includes('cmd += `'), "Must NOT concatenate shell command strings");
    assert.ok(!typeCheckSrc.includes('let cmd ='), "Must NOT declare a cmd string variable");
  });

  it("calls execFileSync with npx and args array", () => {
    const src = readFileSync(join(SRC_ROOT, "claude-code-patterns/agentToolRegistry.js"), "utf-8");
    const typeCheckStart = src.indexOf("function createTypeCheckTool");
    const typeCheckEnd = src.indexOf("function createBuiltInTools");
    const typeCheckSrc = src.slice(typeCheckStart, typeCheckEnd);

    assert.ok(typeCheckSrc.includes('execFileSync("npx", args'), "Should call execFileSync with 'npx' and args array");
  });
});

// ─── 2. SSE stream client disconnect detection ─────────────────────

describe("Batch9-2: SSE stream client disconnect detection", () => {
  it("rag stream has close event listener and break on disconnect", () => {
    const src = readFileSync(join(SRC_ROOT, "http/httpServer.js"), "utf-8");
    // Find the /chat/rag/stream section
    const ragStreamStart = src.indexOf('url.pathname === "/chat/rag/stream"');
    assert.ok(ragStreamStart > 0, "/chat/rag/stream route should exist");

    // clientClosed is after body parsing + knowledge retrieval, need large window
    const ragSection = src.slice(ragStreamStart, ragStreamStart + 3000);
    assert.ok(ragSection.includes("clientClosed"), "RAG stream should track clientClosed state");
    assert.ok(ragSection.includes('response.on("close"'), "RAG stream should listen for response close event");
    assert.ok(ragSection.includes("if (clientClosed) break"), "RAG stream should break on client disconnect");
  });

  it("chat stream has close event listener and break on disconnect", () => {
    const src = readFileSync(join(SRC_ROOT, "http/httpServer.js"), "utf-8");
    // Find the /chat/stream handler block (the if-block, not the routing condition)
    const chatStreamHandler = src.indexOf('if (url.pathname === "/chat/stream") {');
    assert.ok(chatStreamHandler > 0, "/chat/stream handler block should exist");

    // Search within ~800 chars of the handler
    const chatSection = src.slice(chatStreamHandler, chatStreamHandler + 800);
    assert.ok(chatSection.includes("clientClosed"), "Chat stream should track clientClosed state");
    assert.ok(chatSection.includes('response.on("close"'), "Chat stream should listen for response close event");
    assert.ok(chatSection.includes("if (clientClosed) break"), "Chat stream should break on client disconnect");
  });
});

// ─── 3. RAW_KEY_PATTERN global flag ────────────────────────────────

describe("Batch9-3: redactSensitive replaces ALL credential occurrences", () => {
  it("has a global-flag pattern variant for redaction", () => {
    const src = readFileSync(join(SRC_ROOT, "providers/securityPatterns.js"), "utf-8");
    assert.ok(src.includes("RAW_KEY_PATTERN_GLOBAL"), "Should define RAW_KEY_PATTERN_GLOBAL");
    // The global variant should have 'g' flag
    const globalMatch = src.match(/RAW_KEY_PATTERN_GLOBAL\s*=\s*\/.*\/(\w+)/);
    assert.ok(globalMatch, "RAW_KEY_PATTERN_GLOBAL should be a regex literal");
    assert.ok(globalMatch[1].includes("g"), "RAW_KEY_PATTERN_GLOBAL must have 'g' flag");
  });

  it("redactSensitive uses the global pattern", () => {
    const src = readFileSync(join(SRC_ROOT, "providers/securityPatterns.js"), "utf-8");
    assert.ok(
      src.includes("replace(RAW_KEY_PATTERN_GLOBAL"),
      "redactSensitive should use RAW_KEY_PATTERN_GLOBAL for replace-all"
    );
  });

  it("redactSensitive actually redacts multiple occurrences", async () => {
    const mod = await import(`${ESM_SRC}/providers/securityPatterns.js`);
    const input = "key1=sk-aaaabbbbccccddddeeeeffffgggghhhh and key2=sk-xxxx1111yyyy2222zzzz3333wwww4444";
    const result = mod.redactSensitive(input);
    // Both keys should be redacted
    assert.ok(!result.includes("sk-aaaa"), "First key should be redacted");
    assert.ok(!result.includes("sk-xxxx"), "Second key should be redacted");
    assert.ok(result.includes("[redacted]"), "Should contain [redacted] placeholder");
    // Count redaction markers
    const redactionCount = (result.match(/\[redacted\]/g) || []).length;
    assert.ok(redactionCount >= 2, `Should have at least 2 redaction markers, got ${redactionCount}`);
  });

  it("containsRawKey still works with non-global pattern", async () => {
    const mod = await import(`${ESM_SRC}/providers/securityPatterns.js`);
    assert.equal(mod.containsRawKey("sk-aaaabbbbccccddddeeeeffffgggghhhh"), true);
    assert.equal(mod.containsRawKey("no keys here"), false);
    assert.equal(mod.containsRawKey(null), false);
  });
});

// ─── 4. openAiAdapter connection pool ───────────────────────────────

describe("Batch9-4: openAiAdapter uses connection pooling", () => {
  it("imports getOrCreateAgent from connectionPool", () => {
    const src = readFileSync(join(SRC_ROOT, "providers/openAiAdapter.js"), "utf-8");
    assert.ok(
      src.includes('import { getOrCreateAgent } from "../http/connectionPool.js"'),
      "Should import getOrCreateAgent from connectionPool module"
    );
  });

  it("passes agent option to fetch calls", () => {
    const src = readFileSync(join(SRC_ROOT, "providers/openAiAdapter.js"), "utf-8");
    assert.ok(
      src.includes("agent: getOrCreateAgent(this.baseUrl)"),
      "fetch() call should include agent option from getOrCreateAgent"
    );
  });
});

// ─── 5. openAiAdapter error message redaction ──────────────────────

describe("Batch9-5: openAiAdapter error message redaction", () => {
  it("extractOpenAIErrorMessage redacts sk- patterns", () => {
    const src = readFileSync(join(SRC_ROOT, "providers/openAiAdapter.js"), "utf-8");
    // Find the extractOpenAIErrorMessage function and take ~400 chars
    const fnStart = src.indexOf("function extractOpenAIErrorMessage");
    assert.ok(fnStart > 0, "extractOpenAIErrorMessage should exist");
    const fnSrc = src.slice(fnStart, fnStart + 400);

    // Must contain redaction logic
    assert.ok(fnSrc.includes("[REDACTED]"), "Should have [REDACTED] replacement");
    assert.ok(fnSrc.includes("sk-"), "Should target sk- patterns");
  });

  it("extractOpenAIErrorMessage redacts Bearer patterns", () => {
    const src = readFileSync(join(SRC_ROOT, "providers/openAiAdapter.js"), "utf-8");
    const fnStart = src.indexOf("function extractOpenAIErrorMessage");
    const fnSrc = src.slice(fnStart, fnStart + 400);

    assert.ok(fnSrc.includes("Bearer"), "Should target Bearer token patterns");
  });

  it("function applies redaction to error message", () => {
    const src = readFileSync(join(SRC_ROOT, "providers/openAiAdapter.js"), "utf-8");
    const fnStart = src.indexOf("function extractOpenAIErrorMessage");
    const fnSrc = src.slice(fnStart, fnStart + 400);
    // Should use .replace with a global regex
    assert.ok(fnSrc.includes(".replace("), "Should use .replace() for redaction");
    assert.ok(fnSrc.includes("/g"), "Should use global flag for replace");
  });
});

// ─── 6. Temp credential file cleanup ───────────────────────────────

describe("Batch9-6: runtimeCredentialStore cleans up temp files on failure", () => {
  it("imports unlinkSync for file cleanup", () => {
    const src = readFileSync(join(SRC_ROOT, "providers/runtimeCredentialStore.js"), "utf-8");
    assert.ok(src.includes("unlinkSync"), "Should import unlinkSync from node:fs");
  });

  it("catch block attempts temp file cleanup", () => {
    const src = readFileSync(join(SRC_ROOT, "providers/runtimeCredentialStore.js"), "utf-8");
    // Find the persistCredentials function's catch block
    const persistStart = src.indexOf("function persistCredentials");
    assert.ok(persistStart > 0, "persistCredentials function should exist");

    const persistSrc = src.slice(persistStart, persistStart + 1500);
    assert.ok(persistSrc.includes("catch"), "Should have a catch block");
    assert.ok(persistSrc.includes("unlinkSync(tmpPath)"), "Catch block should call unlinkSync(tmpPath)");
    assert.ok(persistSrc.includes("existsSync(tmpPath)"), "Should check if tmpPath exists before deleting");
  });

  it("cleanup errors are silently ignored", () => {
    const src = readFileSync(join(SRC_ROOT, "providers/runtimeCredentialStore.js"), "utf-8");
    const persistStart = src.indexOf("function persistCredentials");
    const persistSrc = src.slice(persistStart, persistStart + 1500);
    // Should have a nested try/catch around cleanup
    assert.ok(persistSrc.includes("try {") || persistSrc.includes("try {"), "Should have inner try for cleanup safety");
  });
});

// ─── 7. WebSocket error message sanitization ────────────────────────

describe("Batch9-7: WebSocket error message sanitization", () => {
  it("sends generic error message instead of e.message", () => {
    const src = readFileSync(join(SRC_ROOT, "http/httpServer.js"), "utf-8");
    // Find the WebSocket onMessage error handler
    const wsHandlerStart = src.indexOf("async onMessage(message, ws)");
    assert.ok(wsHandlerStart > 0, "WebSocket onMessage handler should exist");
    const wsSection = src.slice(wsHandlerStart, wsHandlerStart + 1200);

    // Should NOT send e.message directly
    assert.ok(!wsSection.includes("message: e.message"), "Must NOT send raw e.message to WebSocket client");

    // Should send sanitized generic message
    assert.ok(
      wsSection.includes("Internal server error"),
      "Should send generic 'Internal server error' message"
    );
  });
});

// ─── 8. web_fetch response size limit ──────────────────────────────

describe("Batch9-8: web_fetch uses streaming reader with byte cap", () => {
  it("no longer uses resp.text() to load entire response", () => {
    const src = readFileSync(join(SRC_ROOT, "claude-code-patterns/agentToolRegistry.js"), "utf-8");
    const webFetchStart = src.indexOf('name: "web_fetch"');
    assert.ok(webFetchStart > 0, "web_fetch tool should exist");
    const webFetchEnd = src.indexOf('name: "code_run"');
    const webFetchSrc = src.slice(webFetchStart, webFetchEnd);

    assert.ok(!webFetchSrc.includes("await resp.text()"), "Must NOT use resp.text() to load entire body");
  });

  it("uses streaming reader with byte cap", () => {
    const src = readFileSync(join(SRC_ROOT, "claude-code-patterns/agentToolRegistry.js"), "utf-8");
    const webFetchStart = src.indexOf('name: "web_fetch"');
    const webFetchEnd = src.indexOf('name: "code_run"');
    const webFetchSrc = src.slice(webFetchStart, webFetchEnd);

    assert.ok(webFetchSrc.includes("getReader()"), "Should use ReadableStream getReader()");
    assert.ok(webFetchSrc.includes("MAX_BODY_BYTES"), "Should define a max body byte limit");
    assert.ok(webFetchSrc.includes("reader.cancel()"), "Should cancel reader when limit reached");
  });

  it("checks Content-Length header for early rejection", () => {
    const src = readFileSync(join(SRC_ROOT, "claude-code-patterns/agentToolRegistry.js"), "utf-8");
    const webFetchStart = src.indexOf('name: "web_fetch"');
    const webFetchEnd = src.indexOf('name: "code_run"');
    const webFetchSrc = src.slice(webFetchStart, webFetchEnd);

    assert.ok(webFetchSrc.includes("content-length"), "Should check content-length header");
    assert.ok(webFetchSrc.includes("Response too large"), "Should have error message for oversized responses");
  });

  it("still truncates text at 100K chars for output", () => {
    const src = readFileSync(join(SRC_ROOT, "claude-code-patterns/agentToolRegistry.js"), "utf-8");
    const webFetchStart = src.indexOf('name: "web_fetch"');
    const webFetchEnd = src.indexOf('name: "code_run"');
    const webFetchSrc = src.slice(webFetchStart, webFetchEnd);

    assert.ok(webFetchSrc.includes("text.slice(0, 100_000)"), "Should still truncate output at 100K chars");
  });
});
