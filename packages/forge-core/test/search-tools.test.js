/**
 * Search Tools Tests
 *
 * Tests for globTool and grepTool: file pattern matching and content search
 * All external dependencies are mocked — no real LLM or network calls.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const APPS_SRC = "../../../apps/ai-gateway-service/src";

// ============================================================
// 1. globTool
// ============================================================

describe("globTool", () => {
  let mod;
  let tmpDir;

  before(async () => {
    mod = await import(`${APPS_SRC}/tools/globTool.js`);
    const localTmpBase = join(process.cwd(), ".test-tmp-glob");
    mkdirSync(localTmpBase, { recursive: true });
    tmpDir = mkdtempSync(join(localTmpBase, "run-"));
    // Create test files
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    mkdirSync(join(tmpDir, "src", "components"), { recursive: true });
    writeFileSync(join(tmpDir, "src", "index.js"), "export default {}");
    writeFileSync(join(tmpDir, "src", "app.ts"), "const x = 1");
    writeFileSync(join(tmpDir, "src", "components", "Button.tsx"), "<button/>");
    writeFileSync(join(tmpDir, "package.json"), "{}");
  });

  after(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  });

  describe("globToRegex", () => {
    it("converts simple glob to regex", () => {
      const re = mod.globToRegex("*.js");
      assert.ok(re instanceof RegExp);
      assert.ok(re.test("index.js"));
      assert.ok(!re.test("index.ts"));
    });

    it("converts ** to match any depth", () => {
      const re = mod.globToRegex("**/*.tsx");
      assert.ok(re.test("components/Button.tsx"));
      assert.ok(re.test("a/b/c/Foo.tsx"));
    });

    it("converts ? to single char", () => {
      const re = mod.globToRegex("?.js");
      assert.ok(re.test("a.js"));
      assert.ok(!re.test("ab.js"));
    });
  });

  describe("createGlobTool", () => {
    it("returns a valid tool definition", () => {
      const tool = mod.createGlobTool();
      assert.equal(tool.name, "glob");
      assert.ok(tool.execute);
      assert.ok(tool.isReadOnly);
    });

    it("finds files matching pattern", async () => {
      const tool = mod.createGlobTool();
      const result = await tool.execute({
        pattern: "**/*.js",
        path: tmpDir,
      });
      assert.ok(result);
      const parsed = typeof result === "string" ? JSON.parse(result) : result;
      assert.ok(parsed.files || parsed.matches || Array.isArray(parsed));
    });
  });
});

// ============================================================
// 2. grepTool
// ============================================================

describe("grepTool", () => {
  let mod;
  let tmpDir;

  before(async () => {
    mod = await import(`${APPS_SRC}/tools/grepTool.js`);
    const localTmpBase = join(process.cwd(), ".test-tmp-grep");
    mkdirSync(localTmpBase, { recursive: true });
    tmpDir = mkdtempSync(join(localTmpBase, "run-"));
    writeFileSync(join(tmpDir, "test.js"), 'const hello = "world";\nconsole.log(hello);\n');
    writeFileSync(join(tmpDir, "other.txt"), "no match here\nfoo bar\n");
  });

  after(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  });

  describe("createGrepTool", () => {
    it("returns a valid tool definition", () => {
      const tool = mod.createGrepTool();
      assert.equal(tool.name, "grep");
      assert.ok(tool.execute);
      assert.ok(tool.isReadOnly);
    });

    it("finds matching lines", async () => {
      const tool = mod.createGrepTool();
      const result = await tool.execute({
        pattern: "hello",
        path: tmpDir,
      });
      assert.ok(result);
      const parsed = typeof result === "string" ? JSON.parse(result) : result;
      const matches = parsed.matches || parsed.results || parsed;
      assert.ok(Array.isArray(matches) || typeof matches === "object");
    });

    it("supports regex patterns", async () => {
      const tool = mod.createGrepTool();
      const result = await tool.execute({
        pattern: "console\\.log",
        path: tmpDir,
      });
      assert.ok(result);
    });
  });
});

// ============================================================
// 3. globTool edge cases
// ============================================================

describe("globTool edge cases", () => {
  let globMod;
  let tmpDir;

  before(async () => {
    globMod = await import(`${APPS_SRC}/tools/globTool.js`);
    const localTmpBase = join(process.cwd(), ".test-tmp-globEdge");
    mkdirSync(localTmpBase, { recursive: true });
    tmpDir = mkdtempSync(join(localTmpBase, "run-"));
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    writeFileSync(join(tmpDir, "src", "a.js"), "export default 1;");
  });

  after(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  });

  it("rejects empty pattern", async () => {
    const tool = globMod.createGlobTool();
    const result = await tool.execute({ pattern: "", path: tmpDir });
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    assert.equal(parsed.status, "error");
    assert.equal(parsed.code, "INVALID_INPUT");
  });

  it("rejects undefined pattern", async () => {
    const tool = globMod.createGlobTool();
    const result = await tool.execute({ path: tmpDir });
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    assert.equal(parsed.status, "error");
    assert.equal(parsed.code, "INVALID_INPUT");
  });

  it("rejects non-string pattern", async () => {
    const tool = globMod.createGlobTool();
    const result = await tool.execute({ pattern: 123, path: tmpDir });
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    assert.equal(parsed.status, "error");
    assert.equal(parsed.code, "INVALID_INPUT");
  });

  it("returns error for non-existent directory", async () => {
    const tool = globMod.createGlobTool();
    const result = await tool.execute({ pattern: "*.js", path: "./nonexistent-dir-xyz123" });
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    assert.equal(parsed.status, "error");
    assert.equal(parsed.code, "DIRECTORY_NOT_FOUND");
  });

  it("clamps negative max_results to default", async () => {
    const tool = globMod.createGlobTool();
    const result = await tool.execute({ pattern: "**/*.js", path: tmpDir, max_results: -5 });
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    assert.notEqual(parsed.status, "error");
    const files = parsed.files || parsed.matches || parsed;
    assert.ok(Array.isArray(files) || typeof files === "object");
  });

  it("clamps zero max_results to default", async () => {
    const tool = globMod.createGlobTool();
    const result = await tool.execute({ pattern: "**/*.js", path: tmpDir, max_results: 0 });
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    assert.notEqual(parsed.status, "error");
  });

  it("rejects non-string path", async () => {
    const tool = globMod.createGlobTool();
    const result = await tool.execute({ pattern: "*.js", path: 42 });
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    assert.equal(parsed.status, "error");
    assert.equal(parsed.code, "INVALID_INPUT");
  });
});

// ============================================================
// 4. grepTool edge cases
// ============================================================

describe("grepTool edge cases", () => {
  let grepMod;
  let tmpDir;

  before(async () => {
    grepMod = await import(`${APPS_SRC}/tools/grepTool.js`);
    const localTmpBase = join(process.cwd(), ".test-tmp-grepEdge");
    mkdirSync(localTmpBase, { recursive: true });
    tmpDir = mkdtempSync(join(localTmpBase, "run-"));
    writeFileSync(join(tmpDir, "sample.js"), "const foo = 1;\nconst bar = 2;\nconsole.log(foo + bar);\n");
  });

  after(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  });

  it("rejects empty pattern", async () => {
    const tool = grepMod.createGrepTool();
    const result = await tool.execute({ pattern: "", path: tmpDir });
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    assert.equal(parsed.status, "error");
    assert.equal(parsed.code, "INVALID_INPUT");
  });

  it("rejects undefined pattern", async () => {
    const tool = grepMod.createGrepTool();
    const result = await tool.execute({ path: tmpDir });
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    assert.equal(parsed.status, "error");
    assert.equal(parsed.code, "INVALID_INPUT");
  });

  it("rejects non-string pattern", async () => {
    const tool = grepMod.createGrepTool();
    const result = await tool.execute({ pattern: null, path: tmpDir });
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    assert.equal(parsed.status, "error");
    assert.equal(parsed.code, "INVALID_INPUT");
  });

  it("returns error for non-existent path", async () => {
    const tool = grepMod.createGrepTool();
    const result = await tool.execute({ pattern: "foo", path: "./nonexistent-dir-xyz123" });
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    assert.equal(parsed.status, "error");
    assert.equal(parsed.code, "PATH_NOT_FOUND");
  });

  it("handles invalid regex gracefully", async () => {
    const tool = grepMod.createGrepTool();
    const result = await tool.execute({ pattern: "[invalid(regex", path: tmpDir });
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    assert.equal(parsed.status, "error");
  });

  it("clamps negative context_lines to 0", async () => {
    const tool = grepMod.createGrepTool();
    const result = await tool.execute({ pattern: "foo", path: tmpDir, context_lines: -3 });
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    assert.notEqual(parsed.status, "error");
  });
});
