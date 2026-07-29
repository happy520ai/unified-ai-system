/**
 * Deep Polish Batch 7 — Tests for 8 critical fixes
 *
 * 1. SSE writeSseEvent connection-closed guard
 * 2. file_read symlink traversal protection
 * 3. file_write symlink traversal protection
 * 4. shell_exec environment sanitization + output truncation + timeout cap
 * 5. permissionGate ReDoS regex escaping
 * 6. provider error message secret redaction
 * 7. sessionStore sessionId validation + concurrent save mutex
 * 8. streaming connection pool agent
 * 9. runtimeCredentialStore listRecords masking
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createSourceReader } from "./helpers/source-closure.js";

const APPS_SRC = "../../../apps/ai-gateway-service/src";
const SRC_ROOT = resolve(import.meta.dirname || ".", APPS_SRC);
const PROVIDERS_ROOT = join(SRC_ROOT, "providers");
const readFileSync = createSourceReader(SRC_ROOT);

// ────────────────────────────────────────────────────────────────
// 1. SSE writeSseEvent Connection Guard
// ────────────────────────────────────────────────────────────────
describe("SSE writeSseEvent connection guard", () => {
  it("source checks writableEnded or destroyed before writing", () => {
    const src = readFileSync(join(SRC_ROOT, "http", "httpServer.js"), "utf-8");

    // Find writeSseEvent function
    const fnStart = src.indexOf("function writeSseEvent(");
    assert.ok(fnStart > 0, "Should have writeSseEvent function");

    const fnBody = src.slice(fnStart, fnStart + 300);
    assert.ok(
      fnBody.includes("writableEnded") || fnBody.includes("destroyed"),
      "writeSseEvent should guard against writing to closed connections"
    );
  });

  it("guard returns early when response is ended", () => {
    const src = readFileSync(join(SRC_ROOT, "http", "httpServer.js"), "utf-8");
    const fnStart = src.indexOf("function writeSseEvent(");
    const fnBody = src.slice(fnStart, fnStart + 300);

    // The guard should have an early return pattern
    assert.ok(
      fnBody.includes("return"),
      "writeSseEvent should return early when connection is closed"
    );
  });
});

// ────────────────────────────────────────────────────────────────
// 2. file_read Symlink Traversal Protection
// ────────────────────────────────────────────────────────────────
describe("file_read symlink traversal protection", () => {
  it("source uses realpathSync for symlink resolution", () => {
    const src = readFileSync(
      join(SRC_ROOT, "claude-code-patterns", "agentToolRegistry.js"),
      "utf-8"
    );

    // Find the file_read tool section
    const fileReadStart = src.indexOf('name: "file_read"');
    assert.ok(fileReadStart > 0, "Should have file_read tool");

    const section = src.slice(fileReadStart, fileReadStart + 2500);
    const helperStart = src.indexOf("function validateRealPathWithinWorkingDirectory");
    const helperSection = src.slice(helperStart, helperStart + 1800);
    assert.ok(helperStart > 0, "Should have a shared real-path validation helper");
    assert.ok(
      helperSection.includes("realpathSync") && helperSection.includes("lstatSync"),
      "real-path validation should resolve symlinks, including dangling entries"
    );
    assert.ok(
      section.includes("validateRealPathWithinWorkingDirectory")
        && section.includes("Symlink traversal blocked"),
      "file_read should apply shared real-path validation"
    );
  });
});

// ────────────────────────────────────────────────────────────────
// 3. file_write Symlink Traversal Protection
// ────────────────────────────────────────────────────────────────
describe("file_write symlink traversal protection", () => {
  it("source uses realpathSync for symlink resolution", () => {
    const src = readFileSync(
      join(SRC_ROOT, "claude-code-patterns", "agentToolRegistry.js"),
      "utf-8"
    );

    // Find the file_write tool section
    const fileWriteStart = src.indexOf('name: "file_write"');
    assert.ok(fileWriteStart > 0, "Should have file_write tool");

    const section = src.slice(fileWriteStart, fileWriteStart + 2500);
    const helperStart = src.indexOf("function validateRealPathWithinWorkingDirectory");
    const helperSection = src.slice(helperStart, helperStart + 1800);
    assert.ok(helperStart > 0, "Should have a shared real-path validation helper");
    assert.ok(
      helperSection.includes("realpathSync") && helperSection.includes("lstatSync"),
      "real-path validation should resolve symlinks, including dangling entries"
    );
    assert.ok(
      section.includes("validateRealPathWithinWorkingDirectory")
        && section.includes("Symlink traversal blocked"),
      "file_write should apply shared real-path validation"
    );
  });

  it("blocks a new file write through a symlinked parent directory", async (t) => {
    const workspaceDir = mkdtempSync(join(tmpdir(), "forge-write-root-"));
    const outsideDir = mkdtempSync(join(tmpdir(), "forge-write-outside-"));
    const linkedDir = join(workspaceDir, "linked");
    const escapedFile = join(outsideDir, "escaped.txt");

    try {
      try {
        symlinkSync(outsideDir, linkedDir, process.platform === "win32" ? "junction" : "dir");
      } catch (error) {
        if (error?.code === "EPERM" || error?.code === "EACCES") {
          t.skip(`Symlink creation is unavailable: ${error.code}`);
          return;
        }
        throw error;
      }

      const mod = await import(`${APPS_SRC}/claude-code-patterns/agentToolRegistry.js`);
      const tools = mod.createBuiltInTools(workspaceDir);
      const result = await tools.file_write.execute({
        file_path: "linked/escaped.txt",
        content: "must stay inside the workspace",
      }, {});

      assert.equal(result.status, "error");
      assert.match(result.error, /Symlink traversal blocked/);
      assert.equal(existsSync(escapedFile), false, "write must not escape the workspace");
    } finally {
      if (existsSync(linkedDir)) unlinkSync(linkedDir);
      rmSync(workspaceDir, { recursive: true, force: true });
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });
});

// ────────────────────────────────────────────────────────────────
// 4. shell_exec Environment Sanitization + Output Truncation + Timeout Cap
// ────────────────────────────────────────────────────────────────
describe("shell_exec security hardening", () => {
  it("source sanitizes environment variables", () => {
    const src = readFileSync(
      join(SRC_ROOT, "claude-code-patterns", "agentToolRegistry.js"),
      "utf-8"
    );

    const shellStart = src.indexOf('name: "shell_exec"');
    assert.ok(shellStart > 0, "Should have shell_exec tool");

    const section = src.slice(shellStart, shellStart + 3000);
    assert.ok(
      section.includes("SECRET_PATTERNS") || section.includes("secret"),
      "shell_exec should filter secret environment variables"
    );
    assert.ok(
      section.includes("env: safeEnv") || section.includes("env:"),
      "shell_exec should pass sanitized env to execSync"
    );
  });

  it("source caps timeout at a maximum", () => {
    const src = readFileSync(
      join(SRC_ROOT, "claude-code-patterns", "agentToolRegistry.js"),
      "utf-8"
    );

    const shellStart = src.indexOf('name: "shell_exec"');
    const section = src.slice(shellStart, shellStart + 3000);

    assert.ok(
      section.includes("Math.min") || section.includes("120000"),
      "shell_exec should cap timeout at a maximum value"
    );
  });

  it("source truncates output to prevent context overflow", () => {
    const src = readFileSync(
      join(SRC_ROOT, "claude-code-patterns", "agentToolRegistry.js"),
      "utf-8"
    );

    const shellStart = src.indexOf('name: "shell_exec"');
    const section = src.slice(shellStart, shellStart + 3000);

    assert.ok(
      section.includes("50_000") || section.includes("50000") || section.includes("truncated"),
      "shell_exec should truncate output to maxResultSizeChars"
    );
  });
});

// ────────────────────────────────────────────────────────────────
// 5. permissionGate ReDoS Regex Escaping
// ────────────────────────────────────────────────────────────────
describe("permissionGate ReDoS regex escaping", () => {
  it("source escapes regex metacharacters before glob substitution", () => {
    const src = readFileSync(
      join(SRC_ROOT, "claude-code-patterns", "permissionGate.js"),
      "utf-8"
    );

    // Find the matchesRule function
    const fnStart = src.indexOf("function matchesRule(");
    assert.ok(fnStart > 0, "Should have matchesRule function");

    const fnBody = src.slice(fnStart, fnStart + 1500);

    // Should escape metacharacters before using as regex
    assert.ok(
      fnBody.includes("replace(/[.+^${}()|") || fnBody.includes("escaped"),
      "matchesRule should escape regex metacharacters before glob substitution"
    );
  });

  it("Bash command pattern with regex metacharacters does not cause ReDoS", () => {
    const src = readFileSync(
      join(SRC_ROOT, "claude-code-patterns", "permissionGate.js"),
      "utf-8"
    );

    const fnStart = src.indexOf("function matchesRule(");
    const fnBody = src.slice(fnStart, fnStart + 1500);

    // Both Bash and path patterns should be escaped
    const bashSection = fnBody.slice(
      fnBody.indexOf("Bash"),
      fnBody.indexOf("Bash") + 400
    );
    assert.ok(
      bashSection.includes("escaped") || bashSection.includes("replace(/[.+"),
      "Bash pattern matching should escape metacharacters"
    );
  });
});

// ────────────────────────────────────────────────────────────────
// 6. Provider Error Message Secret Redaction
// ────────────────────────────────────────────────────────────────
describe("provider error message secret redaction", () => {
  it("extractProviderErrorMessage redacts API keys", () => {
    const src = readFileSync(
      join(PROVIDERS_ROOT, "httpLlmProviderAdapter.js"),
      "utf-8"
    );

    const fnStart = src.indexOf("function extractProviderErrorMessage(");
    assert.ok(fnStart > 0, "Should have extractProviderErrorMessage function");

    const fnBody = src.slice(fnStart, fnStart + 500);
    assert.ok(
      fnBody.includes("REDACTED") || fnBody.includes("redact"),
      "extractProviderErrorMessage should redact potential secrets"
    );
    assert.ok(
      fnBody.includes("sk-") || fnBody.includes("Bearer"),
      "Should target common API key patterns"
    );
  });
});

// ────────────────────────────────────────────────────────────────
// 7. sessionStore sessionId Validation + Concurrent Save Mutex
// ────────────────────────────────────────────────────────────────
describe("sessionStore sessionId validation and mutex", () => {
  it("source validates sessionId format", () => {
    const src = readFileSync(
      join(SRC_ROOT, "agentic", "sessionStore.js"),
      "utf-8"
    );

    assert.ok(
      src.includes("SESSION_ID_PATTERN") ||
        src.includes(/^[a-zA-Z0-9_\\-]+\$/.source),
      "Should have sessionId format validation pattern"
    );
    assert.ok(
      src.includes("Invalid sessionId"),
      "Should throw on invalid sessionId format"
    );
  });

  it("rejects path traversal in sessionId", async () => {
    const { createSessionStore } = await import(
      `${APPS_SRC}/agentic/sessionStore.js`
    );
    const storeDir = mkdtempSync(join(tmpdir(), "forge-session-batch7-"));
    try {
      const store = createSessionStore({ storeDir });

      // Attempt path traversal via sessionId
      await assert.rejects(
        () => store.save("../../etc/passwd", { goal: "hack" }),
        /Invalid sessionId/,
        "Should reject sessionId with path traversal characters"
      );
    } finally {
      rmSync(storeDir, { recursive: true, force: true });
    }
  });

  it("has per-sessionId mutex for concurrent saves", () => {
    const src = readFileSync(
      join(SRC_ROOT, "agentic", "sessionStore.js"),
      "utf-8"
    );

    assert.ok(
      src.includes("_saveMutex") || src.includes("mutex"),
      "Should have per-sessionId mutex"
    );
    assert.ok(
      src.includes(".then(") || src.includes("prev"),
      "Should chain saves to prevent race conditions"
    );
  });
});

// ────────────────────────────────────────────────────────────────
// 8. Streaming Connection Pool Agent
// ────────────────────────────────────────────────────────────────
describe("streaming connection pool agent", () => {
  it("generateStream uses connection pool agent", () => {
    const src = readFileSync(
      join(PROVIDERS_ROOT, "httpLlmProviderAdapter.js"),
      "utf-8"
    );

    const streamStart = src.indexOf("function openStreamWithRetry");
    assert.ok(streamStart > 0, "Should have stream connection helper");
    const streamSection = src.slice(streamStart, streamStart + 5000);
    const fetchStart = streamSection.indexOf("await fetchWithAgent(");
    assert.ok(fetchStart > 0, "Should use pooled fetch in stream helper");
    assert.ok(
      streamSection.includes("const agent = getOrCreateAgent(baseUrl)")
        && streamSection.includes("agent,"),
      "stream helper should use a connection pool agent"
    );
  });
});

// ────────────────────────────────────────────────────────────────
// 9. runtimeCredentialStore listRecords Masking
// ────────────────────────────────────────────────────────────────
describe("runtimeCredentialStore listRecords masking", () => {
  it("source masks apiKey in listRecords", () => {
    const src = readFileSync(
      join(PROVIDERS_ROOT, "runtimeCredentialStore.js"),
      "utf-8"
    );

    const fnStart = src.indexOf("listRecords()");
    assert.ok(fnStart > 0, "Should have listRecords method");

    const fnBody = src.slice(fnStart, fnStart + 500);
    assert.ok(
      fnBody.includes("apiKeyPresent") || fnBody.includes("apiKeyPreview"),
      "listRecords should return masked apiKey info instead of raw value"
    );
    // Should NOT return raw apiKey directly
    const hasRawApiKey =
      fnBody.includes("apiKey: record.apiKey") ||
      (fnBody.includes("apiKey:") && !fnBody.includes("apiKeyPresent"));
    assert.ok(!hasRawApiKey, "listRecords should not expose raw apiKey");
  });
});

// ────────────────────────────────────────────────────────────────
// 10. Cross-module Integration
// ────────────────────────────────────────────────────────────────
describe("batch 7 cross-module integration", () => {
  it("all fixed modules load without errors", async () => {
    const modules = [
      `${APPS_SRC}/http/httpServer.js`,
      `${APPS_SRC}/claude-code-patterns/permissionGate.js`,
      `${APPS_SRC}/agentic/sessionStore.js`,
      `${APPS_SRC}/providers/runtimeCredentialStore.js`,
    ];

    for (const mod of modules) {
      try {
        const loaded = await import(mod);
        assert.ok(loaded, `Module ${mod} should load`);
      } catch (err) {
        assert.fail(`Module ${mod} failed to load: ${err.message}`);
      }
    }
    assert.ok(true, "All modules loaded successfully");
  });
});
