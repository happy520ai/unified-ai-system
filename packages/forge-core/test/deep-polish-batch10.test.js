/**
 * Deep Polish Batch 10 — Tests for 8 critical fixes
 *
 * 1. sessionStore load/remove path traversal validation
 * 2. agenticStreamHandler writeSseEvent writableEnded/destroyed guard
 * 3. httpServer SSE response.end() clientClosed guards (rag + chat streams)
 * 4. httpServer writeHtml writableEnded/headersSent guard
 * 5. webSocketServer async onMessage promise rejection catch
 * 6. multimodalProviderAdapter Gemini API key URL→header (image gen + embedding)
 * 7. mcpBridge SSE stream 1MB buffer cap
 * 8. knowledgePersistence JSON.parse crash guard
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

// ─── 1. sessionStore path traversal validation ─────────────────────

describe("Batch10-1: sessionStore load/remove path traversal validation", () => {
  it("load validates sessionId format with SESSION_ID_PATTERN", () => {
    const src = readFileSync(join(SRC_ROOT, "agentic/sessionStore.js"), "utf-8");
    const loadStart = src.indexOf("async function load(");
    assert.ok(loadStart > 0, "load function should exist");
    const loadSrc = src.slice(loadStart, loadStart + 400);

    assert.ok(loadSrc.includes("SESSION_ID_PATTERN.test"), "load should validate sessionId with SESSION_ID_PATTERN");
    assert.ok(loadSrc.includes("return null"), "load should return null for invalid sessionId");
  });

  it("remove validates sessionId format before file deletion", () => {
    const src = readFileSync(join(SRC_ROOT, "agentic/sessionStore.js"), "utf-8");
    const removeStart = src.indexOf("async function remove(");
    assert.ok(removeStart > 0, "remove function should exist");
    const removeSrc = src.slice(removeStart, removeStart + 400);

    assert.ok(removeSrc.includes("SESSION_ID_PATTERN.test"), "remove should validate sessionId with SESSION_ID_PATTERN");
    assert.ok(removeSrc.includes("return false"), "remove should return false for invalid sessionId");
  });

  it("SESSION_ID_PATTERN blocks path traversal characters", () => {
    const src = readFileSync(join(SRC_ROOT, "agentic/sessionStore.js"), "utf-8");
    // Extract the pattern definition
    const patternMatch = src.match(/SESSION_ID_PATTERN\s*=\s*\/(.+)\//);
    assert.ok(patternMatch, "SESSION_ID_PATTERN should be defined as a regex literal");

    // The pattern should only allow safe characters
    const pattern = new RegExp(patternMatch[1]);
    assert.ok(pattern.test("valid-session_123"), "Should allow alphanumeric, dash, underscore");
    assert.ok(!pattern.test("../etc/passwd"), "Should block path traversal with dots and slashes");
    assert.ok(!pattern.test("session/../../etc"), "Should block slashes");
    assert.ok(!pattern.test("session\\..\\.."), "Should block backslashes");
    assert.ok(!pattern.test("session with spaces"), "Should block spaces");
  });

  it("exportSession inherits load validation (delegates to load)", () => {
    const src = readFileSync(join(SRC_ROOT, "agentic/sessionStore.js"), "utf-8");
    const exportStart = src.indexOf("async function exportSession");
    assert.ok(exportStart > 0, "exportSession function should exist");
    const exportSrc = src.slice(exportStart, exportStart + 200);

    assert.ok(exportSrc.includes("await load(sessionId)"), "exportSession should delegate to load()");
    assert.ok(exportSrc.includes("if (!session) return null"), "exportSession should return null when load returns null");
  });

  it("load and remove both reject null/undefined sessionId", () => {
    const src = readFileSync(join(SRC_ROOT, "agentic/sessionStore.js"), "utf-8");

    const loadStart = src.indexOf("async function load(");
    const loadSrc = src.slice(loadStart, loadStart + 200);
    assert.ok(loadSrc.includes("if (!sessionId) return null"), "load should return null for falsy sessionId");

    const removeStart = src.indexOf("async function remove(");
    const removeSrc = src.slice(removeStart, removeStart + 200);
    assert.ok(removeSrc.includes("!sessionId"), "remove should check for falsy sessionId");
  });
});

// ─── 2. agenticStreamHandler writeSseEvent writableEnded guard ─────

describe("Batch10-2: writeSseEvent writableEnded/destroyed guard", () => {
  it("checks writableEnded before writing", () => {
    const src = readFileSync(join(SRC_ROOT, "agentic/agenticStreamHandler.js"), "utf-8");
    const writeSseStart = src.indexOf("function writeSseEvent(");
    assert.ok(writeSseStart > 0, "writeSseEvent function should exist");
    const writeSseSrc = src.slice(writeSseStart, writeSseStart + 300);

    assert.ok(writeSseSrc.includes("writableEnded"), "Should check writableEnded");
  });

  it("checks destroyed before writing", () => {
    const src = readFileSync(join(SRC_ROOT, "agentic/agenticStreamHandler.js"), "utf-8");
    const writeSseStart = src.indexOf("function writeSseEvent(");
    const writeSseSrc = src.slice(writeSseStart, writeSseStart + 300);

    assert.ok(writeSseSrc.includes("destroyed"), "Should check destroyed");
  });

  it("returns early when stream is closed", () => {
    const src = readFileSync(join(SRC_ROOT, "agentic/agenticStreamHandler.js"), "utf-8");
    const writeSseStart = src.indexOf("function writeSseEvent(");
    const writeSseSrc = src.slice(writeSseStart, writeSseStart + 300);

    // Should have guard that returns before res.write
    const guardIdx = writeSseSrc.indexOf("return");
    const writeIdx = writeSseSrc.indexOf("res.write(");
    assert.ok(guardIdx > 0, "Should have a return guard");
    assert.ok(writeIdx > 0, "Should have res.write call");
    assert.ok(guardIdx < writeIdx, "Guard should come BEFORE res.write");
  });

  it("guard uses OR condition (writableEnded || destroyed)", () => {
    const src = readFileSync(join(SRC_ROOT, "agentic/agenticStreamHandler.js"), "utf-8");
    const writeSseStart = src.indexOf("function writeSseEvent(");
    const writeSseSrc = src.slice(writeSseStart, writeSseStart + 300);

    assert.ok(
      writeSseSrc.includes("res.writableEnded || res.destroyed"),
      "Should use OR condition for both writableEnded and destroyed"
    );
  });
});

// ─── 3. httpServer SSE response.end() clientClosed guards ──────────

describe("Batch10-3: SSE response.end() guarded by clientClosed", () => {
  it("rag stream guards response.end() with clientClosed check", () => {
    const src = readFileSync(join(SRC_ROOT, "http/httpServer.js"), "utf-8");
    const ragStart = src.indexOf('url.pathname === "/chat/rag/stream"');
    assert.ok(ragStart > 0, "/chat/rag/stream route should exist");
    const ragSection = src.slice(ragStart, ragStart + 4000);

    // Find response.end() and check it's guarded
    assert.ok(ragSection.includes("if (!clientClosed) response.end()"), "RAG stream should guard response.end() with !clientClosed");
  });

  it("chat stream guards response.end() with clientClosed check", () => {
    const src = readFileSync(join(SRC_ROOT, "http/httpServer.js"), "utf-8");
    const chatStart = src.indexOf('if (url.pathname === "/chat/stream") {');
    assert.ok(chatStart > 0, "/chat/stream handler should exist");
    const chatSection = src.slice(chatStart, chatStart + 1500);

    assert.ok(chatSection.includes("if (!clientClosed) response.end()"), "Chat stream should guard response.end() with !clientClosed");
  });
});

// ─── 4. httpServer writeHtml writableEnded/headersSent guard ───────

describe("Batch10-4: writeHtml writableEnded/headersSent guard", () => {
  it("checks writableEnded before writing HTML", () => {
    const src = readFileSync(join(SRC_ROOT, "http/httpServer.js"), "utf-8");
    const writeHtmlStart = src.indexOf("function writeHtml(");
    assert.ok(writeHtmlStart > 0, "writeHtml function should exist");
    const writeHtmlSrc = src.slice(writeHtmlStart, writeHtmlStart + 300);

    assert.ok(writeHtmlSrc.includes("writableEnded"), "Should check writableEnded");
  });

  it("checks headersSent before writing HTML", () => {
    const src = readFileSync(join(SRC_ROOT, "http/httpServer.js"), "utf-8");
    const writeHtmlStart = src.indexOf("function writeHtml(");
    const writeHtmlSrc = src.slice(writeHtmlStart, writeHtmlStart + 300);

    assert.ok(writeHtmlSrc.includes("headersSent"), "Should check headersSent");
  });

  it("returns early when response is already closed or headers sent", () => {
    const src = readFileSync(join(SRC_ROOT, "http/httpServer.js"), "utf-8");
    const writeHtmlStart = src.indexOf("function writeHtml(");
    const writeHtmlSrc = src.slice(writeHtmlStart, writeHtmlStart + 300);

    // Guard should come before writeHead
    const guardIdx = writeHtmlSrc.indexOf("return");
    const writeHeadIdx = writeHtmlSrc.indexOf("writeHead");
    assert.ok(guardIdx > 0, "Should have a return guard");
    assert.ok(writeHeadIdx > 0, "Should have writeHead call");
    assert.ok(guardIdx < writeHeadIdx, "Guard should come BEFORE writeHead");

    assert.ok(
      writeHtmlSrc.includes("response.writableEnded || response.headersSent"),
      "Should use OR condition for both writableEnded and headersSent"
    );
  });
});

// ─── 5. webSocketServer async onMessage promise rejection catch ────

describe("Batch10-5: WebSocket async onMessage promise rejection catch", () => {
  it("catches promise rejections from async onMessage handler", () => {
    const src = readFileSync(join(SRC_ROOT, "http/webSocketServer.js"), "utf-8");
    const onDataStart = src.indexOf('socket.on("data"');
    assert.ok(onDataStart > 0, "socket.on('data') handler should exist");
    const onDataSrc = src.slice(onDataStart, onDataStart + 600);

    // Should check if result is a promise and catch rejections
    assert.ok(onDataSrc.includes("typeof result.catch"), "Should check if result has .catch method");
    assert.ok(onDataSrc.includes('typeof result.catch === "function"'), "Should verify .catch is a function");
  });

  it("prevents unhandled promise rejection crash", () => {
    const src = readFileSync(join(SRC_ROOT, "http/webSocketServer.js"), "utf-8");
    const onDataStart = src.indexOf('socket.on("data"');
    const onDataSrc = src.slice(onDataStart, onDataStart + 600);

    assert.ok(onDataSrc.includes("result.catch(() => {})"), "Should catch rejections with no-op handler");
    assert.ok(onDataSrc.includes("result && typeof result.catch"), "Should null-check result before accessing .catch");
  });

  it("only applies catch to promise-like results (duck-typed check)", () => {
    const src = readFileSync(join(SRC_ROOT, "http/webSocketServer.js"), "utf-8");
    const onDataStart = src.indexOf('socket.on("data"');
    const onDataSrc = src.slice(onDataStart, onDataStart + 600);

    // The condition should verify result exists AND has .catch
    assert.ok(
      onDataSrc.includes("if (result && typeof result.catch"),
      "Should use duck-typed check: result exists AND has .catch"
    );
  });
});

// ─── 6. multimodalProviderAdapter Gemini API key header ─────────────

describe("Batch10-6: Gemini API key moved from URL to x-goog-api-key header", () => {
  it("Gemini image generation URL has no ?key= query parameter", () => {
    const src = readFileSync(join(SRC_ROOT, "providers/multimodalProviderAdapter.js"), "utf-8");
    const imgStart = src.indexOf("async #geminiImageGeneration(");
    assert.ok(imgStart > 0, "#geminiImageGeneration method should exist");
    const imgSrc = src.slice(imgStart, imgStart + 800);

    assert.ok(!imgSrc.includes("?key="), "Image generation URL must NOT contain ?key= query parameter");
  });

  it("Gemini embedding URL has no ?key= query parameter", () => {
    const src = readFileSync(join(SRC_ROOT, "providers/multimodalProviderAdapter.js"), "utf-8");
    const embStart = src.indexOf("async #geminiEmbedding(");
    assert.ok(embStart > 0, "#geminiEmbedding method should exist");
    const embSrc = src.slice(embStart, embStart + 800);

    assert.ok(!embSrc.includes("?key="), "Embedding URL must NOT contain ?key= query parameter");
  });

  it("Gemini image generation uses x-goog-api-key header via extraHeaders", () => {
    const src = readFileSync(join(SRC_ROOT, "providers/multimodalProviderAdapter.js"), "utf-8");
    const imgStart = src.indexOf("async #geminiImageGeneration(");
    const imgSrc = src.slice(imgStart, imgStart + 800);

    assert.ok(imgSrc.includes('"x-goog-api-key"'), "Should use x-goog-api-key header");
    assert.ok(imgSrc.includes("extraHeaders"), "Should pass extraHeaders to #callJson");
    assert.ok(imgSrc.includes("apiKey: null"), "Should set apiKey to null to suppress Bearer auth");
  });

  it("Gemini embedding uses x-goog-api-key header via extraHeaders", () => {
    const src = readFileSync(join(SRC_ROOT, "providers/multimodalProviderAdapter.js"), "utf-8");
    const embStart = src.indexOf("async #geminiEmbedding(");
    const embSrc = src.slice(embStart, embStart + 1200);

    assert.ok(embSrc.includes('"x-goog-api-key"'), "Should use x-goog-api-key header");
    assert.ok(embSrc.includes("extraHeaders"), "Should pass extraHeaders to #callJson");
    assert.ok(embSrc.includes("apiKey: null"), "Should set apiKey to null to suppress Bearer auth");
  });

  it("no ?key= query parameters remain anywhere in the file", () => {
    const src = readFileSync(join(SRC_ROOT, "providers/multimodalProviderAdapter.js"), "utf-8");
    assert.ok(!src.includes("?key="), "No ?key= query parameters should remain in the entire file");
  });

  it("x-goog-api-key appears at least twice (image + embedding)", () => {
    const src = readFileSync(join(SRC_ROOT, "providers/multimodalProviderAdapter.js"), "utf-8");
    const matches = src.match(/x-goog-api-key/g) || [];
    // Each method has the key name in a comment and in extraHeaders, so at least 4 occurrences
    assert.ok(matches.length >= 4, `Should have at least 4 x-goog-api-key references (2 comments + 2 extraHeaders), got ${matches.length}`);
  });
});

// ─── 7. mcpBridge SSE stream buffer cap ────────────────────────────

describe("Batch10-7: mcpBridge SSE stream 1MB buffer cap", () => {
  it("defines MAX_SSE_BUFFER constant", () => {
    const src = readFileSync(join(SRC_ROOT, "claude-code-patterns/mcpBridge.js"), "utf-8");
    const readSseStart = src.indexOf("async function readSseStream");
    assert.ok(readSseStart > 0, "readSseStream function should exist");
    const readSseSrc = src.slice(readSseStart, readSseStart + 700);

    assert.ok(readSseSrc.includes("MAX_SSE_BUFFER"), "Should define MAX_SSE_BUFFER constant");
    assert.ok(readSseSrc.includes("1024 * 1024"), "MAX_SSE_BUFFER should be 1MB (1024 * 1024)");
  });

  it("checks buffer length and cancels reader on overflow", () => {
    const src = readFileSync(join(SRC_ROOT, "claude-code-patterns/mcpBridge.js"), "utf-8");
    const readSseStart = src.indexOf("async function readSseStream");
    const readSseSrc = src.slice(readSseStart, readSseStart + 700);

    assert.ok(readSseSrc.includes("buffer.length > MAX_SSE_BUFFER"), "Should check buffer length against cap");
    assert.ok(readSseSrc.includes("reader.cancel()"), "Should cancel reader when buffer exceeds limit");
  });

  it("emits error event on buffer overflow", () => {
    const src = readFileSync(join(SRC_ROOT, "claude-code-patterns/mcpBridge.js"), "utf-8");
    const readSseStart = src.indexOf("async function readSseStream");
    const readSseSrc = src.slice(readSseStart, readSseStart + 700);

    assert.ok(readSseSrc.includes('emitter.emit("error"'), "Should emit error event on overflow");
    assert.ok(readSseSrc.includes("return"), "Should return after emitting error to stop processing");
  });

  it("buffer check happens AFTER appending new data", () => {
    const src = readFileSync(join(SRC_ROOT, "claude-code-patterns/mcpBridge.js"), "utf-8");
    const readSseStart = src.indexOf("async function readSseStream");
    const readSseSrc = src.slice(readSseStart, readSseStart + 700);

    // buffer += should come before buffer.length > MAX_SSE_BUFFER
    const appendIdx = readSseSrc.indexOf("buffer +=");
    const checkIdx = readSseSrc.indexOf("buffer.length > MAX_SSE_BUFFER");
    assert.ok(appendIdx > 0, "Should append to buffer");
    assert.ok(checkIdx > 0, "Should check buffer length");
    assert.ok(appendIdx < checkIdx, "Buffer append should happen BEFORE length check");
  });
});

// ─── 8. knowledgePersistence JSON.parse crash guard ────────────────

describe("Batch10-8: knowledgePersistence JSON.parse crash guard", () => {
  it("wraps JSON.parse in try/catch", () => {
    const src = readFileSync(join(SRC_ROOT, "knowledge/knowledgePersistence.js"), "utf-8");
    const readStart = src.indexOf("function readFileDocuments");
    assert.ok(readStart > 0, "readFileDocuments function should exist");
    const readSrc = src.slice(readStart, readStart + 500);

    assert.ok(readSrc.includes("try {"), "Should have try block around JSON.parse");
    assert.ok(readSrc.includes("catch"), "Should have catch block for parse errors");
  });

  it("returns empty array on corrupted file instead of crashing", () => {
    const src = readFileSync(join(SRC_ROOT, "knowledge/knowledgePersistence.js"), "utf-8");
    const readStart = src.indexOf("function readFileDocuments");
    const readSrc = src.slice(readStart, readStart + 500);

    // catch block should return empty array
    const catchIdx = readSrc.indexOf("catch");
    assert.ok(catchIdx > 0, "Should have catch block");
    const catchBlock = readSrc.slice(catchIdx, catchIdx + 200);
    assert.ok(catchBlock.includes("return []"), "catch block should return empty array for corrupted files");
  });

  it("still checks file existence before parsing", () => {
    const src = readFileSync(join(SRC_ROOT, "knowledge/knowledgePersistence.js"), "utf-8");
    const readStart = src.indexOf("function readFileDocuments");
    const readSrc = src.slice(readStart, readStart + 500);

    assert.ok(readSrc.includes("existsSync(filePath)"), "Should still check if file exists");
    // Existence check should come before JSON.parse
    const existsIdx = readSrc.indexOf("existsSync(filePath)");
    const parseIdx = readSrc.indexOf("JSON.parse");
    assert.ok(existsIdx < parseIdx, "Existence check should come before JSON.parse");
  });

  it("still processes documents array normally on valid input", () => {
    const src = readFileSync(join(SRC_ROOT, "knowledge/knowledgePersistence.js"), "utf-8");
    const readStart = src.indexOf("function readFileDocuments");
    const readSrc = src.slice(readStart, readStart + 500);

    assert.ok(readSrc.includes("Array.isArray(parsed"), "Should still check for documents array");
    assert.ok(readSrc.includes("document.sourceId"), "Should still map document fields");
    assert.ok(readSrc.includes("document.documentId"), "Should still include documentId in mapping");
  });
});
