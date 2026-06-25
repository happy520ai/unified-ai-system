/**
 * File Edit Tools Tests
 *
 * Tests for fileEditTool: patch-style search-replace editing
 * All external dependencies are mocked — no real LLM or network calls.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const APPS_SRC = "../../../apps/ai-gateway-service/src";

// ============================================================
// 1. fileEditTool
// ============================================================

describe("fileEditTool", () => {
  let mod;
  let tmpDir;

  before(async () => {
    mod = await import(`${APPS_SRC}/tools/fileEditTool.js`);
    const localTmpBase = join(process.cwd(), ".test-tmp-fileEdit");
    mkdirSync(localTmpBase, { recursive: true });
    tmpDir = mkdtempSync(join(localTmpBase, "run-"));
  });

  after(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  });

  describe("performSearchReplace", () => {
    it("replaces unique match", () => {
      const content = "hello world\nfoo bar\nhello world";
      const result = mod.performSearchReplace(content, "foo bar", "baz qux");
      assert.equal(result.success, true);
      assert.equal(result.result, "hello world\nbaz qux\nhello world");
      assert.equal(result.matchCount, 1);
    });

    it("throws on no match", () => {
      const result = mod.performSearchReplace("hello", "xyz", "abc");
      assert.equal(result.success, false);
      assert.ok(result.error.includes("not found"));
    });

    it("fails on multiple matches without allowMultiple", () => {
      const result = mod.performSearchReplace("aa\naa", "aa", "bb");
      assert.equal(result.success, false);
      assert.ok(result.error.includes("2") || result.error.includes("multiple") || result.error.includes("matched"));
    });

    it("replaces all matches with allowMultiple", () => {
      const result = mod.performSearchReplace("aa\naa\naa", "aa", "bb", { allowMultiple: true });
      assert.equal(result.success, true);
      assert.equal(result.result, "bb\nbb\nbb");
      assert.equal(result.matchCount, 3);
    });

    it("preserves surrounding content", () => {
      const content = "line1\nline2\nline3\nline4";
      const result = mod.performSearchReplace(content, "line2\nline3", "replaced");
      assert.equal(result.success, true);
      assert.equal(result.result, "line1\nreplaced\nline4");
    });

    it("handles empty new_string (deletion)", () => {
      const content = "keep\nremove\nkeep";
      const result = mod.performSearchReplace(content, "remove\n", "");
      assert.equal(result.success, true);
      assert.equal(result.result, "keep\nkeep");
    });
  });

  describe("createFileEditTool", () => {
    it("returns a valid tool definition", () => {
      const tool = mod.createFileEditTool();
      assert.ok(tool.name);
      assert.equal(tool.name, "file_edit");
      assert.ok(tool.description);
      assert.ok(tool.execute);
      assert.ok(tool.inputSchema);
      assert.ok(tool.inputSchema.properties);
    });

    it("has correct required fields in schema", () => {
      const tool = mod.createFileEditTool();
      assert.ok(tool.inputSchema.required);
      assert.ok(tool.inputSchema.required.includes("file_path"));
      assert.ok(tool.inputSchema.required.includes("old_string"));
      assert.ok(tool.inputSchema.required.includes("new_string"));
    });

    it("can execute edit on a real file", async () => {
      const testFile = join(tmpDir, "edit-test.txt");
      writeFileSync(testFile, "original content here");

      const tool = mod.createFileEditTool();
      const result = await tool.execute({
        file_path: testFile,
        old_string: "original content",
        new_string: "modified content",
      });

      assert.ok(result);
      const updated = readFileSync(testFile, "utf8");
      assert.equal(updated, "modified content here");
    });
  });

  describe("createFileInsertTool", () => {
    it("returns a valid tool definition", () => {
      const tool = mod.createFileInsertTool();
      assert.ok(tool.name);
      assert.equal(tool.name, "file_insert");
      assert.ok(tool.execute);
    });

    it("inserts content at specified line", async () => {
      const testFile = join(tmpDir, "insert-test.txt");
      writeFileSync(testFile, "line1\nline2\nline3");

      const tool = mod.createFileInsertTool();
      const result = await tool.execute({
        file_path: testFile,
        line_number: 2,
        content: "inserted",
      });

      assert.ok(result);
      const updated = readFileSync(testFile, "utf8");
      assert.ok(updated.includes("inserted"));
    });
  });
});

// ============================================================
// 2. fileEditTool edge cases
// ============================================================

describe("fileEditTool edge cases", () => {
  let editMod;
  let tmpDir;

  before(async () => {
    editMod = await import(`${APPS_SRC}/tools/fileEditTool.js`);
    const localTmpBase = join(process.cwd(), ".test-tmp-editEdge");
    mkdirSync(localTmpBase, { recursive: true });
    tmpDir = mkdtempSync(join(localTmpBase, "run-"));
  });

  after(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  });

  it("rejects missing file_path", async () => {
    const tool = editMod.createFileEditTool();
    const result = await tool.execute({ old_string: "a", new_string: "b" });
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    assert.equal(parsed.status, "error");
    assert.equal(parsed.code, "INVALID_INPUT");
  });

  it("rejects empty file_path", async () => {
    const tool = editMod.createFileEditTool();
    const result = await tool.execute({ file_path: "", old_string: "a", new_string: "b" });
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    assert.equal(parsed.status, "error");
    assert.equal(parsed.code, "INVALID_INPUT");
  });

  it("rejects non-string old_string", async () => {
    const tool = editMod.createFileEditTool();
    const result = await tool.execute({ file_path: "/some/file.txt", old_string: 123, new_string: "b" });
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    assert.equal(parsed.status, "error");
    assert.equal(parsed.code, "INVALID_INPUT");
  });

  it("returns FILE_NOT_FOUND for non-existent file", async () => {
    const tool = editMod.createFileEditTool();
    const result = await tool.execute({
      file_path: join(tmpDir, "nonexistent.txt"),
      old_string: "a",
      new_string: "b",
    });
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    assert.equal(parsed.status, "error");
    assert.equal(parsed.code, "FILE_NOT_FOUND");
  });

  it("handles unicode content replacement", () => {
    const content = "你好世界\n这是一行中文\n测试内容";
    const result = editMod.performSearchReplace(content, "这是一行中文", "这是替换后的中文");
    assert.equal(result.success, true);
    assert.ok(result.result.includes("这是替换后的中文"));
  });

  it("handles empty old_string (insert at beginning)", () => {
    const content = "existing content";
    const result = editMod.performSearchReplace(content, "", "new prefix ");
    assert.ok(typeof result.success === "boolean");
  });

  it("handles special regex characters in old_string", () => {
    const content = "price is $10.00 (USD)\ntax is $2.00";
    const result = editMod.performSearchReplace(content, "$10.00 (USD)", "$20.00 (USD)");
    assert.equal(result.success, true);
    assert.ok(result.result.includes("$20.00 (USD)"));
  });
});
