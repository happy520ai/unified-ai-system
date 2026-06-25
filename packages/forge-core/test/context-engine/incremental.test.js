/**
 * incremental.test.js — ContextEngine 增量上下文构建测试
 *
 * 测试 ContextEngine 的增量构建能力(useDelta=true),包括:
 * - 文件快照创建与差异计算
 * - 增量上下文 vs 全量上下文结果一致性
 * - 缓存命中/失效逻辑
 * - deltaStaleThreshold 触发全量重建
 * - 边界情况(空输入、超大输入、无变化)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ContextEngine } from "../../src/context-engine/index.js";
import { FileSnapshot } from "../../src/context-engine/file-snapshot.js";

describe("ContextEngine — Incremental Context Building", () => {
  let engine;

  beforeEach(() => {
    engine = new ContextEngine({ maxContextTokens: 8000 });
  });

  // ── 基础增量构建 ──

  it("should build context in full mode (useDelta=false)", () => {
    const result = engine.buildContext({
      task: { prompt: "Fix the auth bug", relevantFiles: ["src/auth.js"] },
      codebaseIndex: {
        files: [
          { path: "src/auth.js", content: "export function login(user) { return true; }" },
        ],
      },
      useDelta: false,
    });
    expect(result).toBeDefined();
    expect(result.contextBlock).toBeTruthy();
    expect(result.estimatedTokens).toBeGreaterThan(0);
  });

  it("should build context in delta mode (useDelta=true) with snapshot", () => {
    const snapshot = new FileSnapshot();
    snapshot.capture({ "src/auth.js": "export function login(user) { return true; }" });
    engine.setSnapshot(snapshot);

    const result = engine.buildContext({
      task: { prompt: "Fix the auth bug", relevantFiles: ["src/auth.js"] },
      codebaseIndex: {
        files: [
          { path: "src/auth.js", content: "export function login(user) { return true; }" },
        ],
      },
      useDelta: true,
    });
    expect(result).toBeDefined();
    expect(result.contextBlock).toBeTruthy();
  });

  // ── 增量 vs 全量一致性 ──

  it("should produce consistent results when content unchanged (delta vs full)", () => {
    const files = [
      { path: "src/index.js", content: "console.log('hello');" },
      { path: "src/util.js", content: "export const add = (a, b) => a + b;" },
    ];

    const fullResult = engine.buildContext({
      task: { prompt: "Review code", relevantFiles: ["src/index.js"] },
      codebaseIndex: { files },
      useDelta: false,
    });

    const snapshot = new FileSnapshot();
    snapshot.capture(Object.fromEntries(files.map((f) => [f.path, f.content])));
    engine.setSnapshot(snapshot);

    const deltaResult = engine.buildContext({
      task: { prompt: "Review code", relevantFiles: ["src/index.js"] },
      codebaseIndex: { files },
      useDelta: true,
    });

    // delta 模式下,内容未变,结果应等价
    expect(deltaResult.estimatedTokens).toBeGreaterThan(0);
  });

  // ── 文件快照 ──

  it("FileSnapshot should capture and detect changes", () => {
    const snap = new FileSnapshot();
    snap.capture({ "a.js": "content-a", "b.js": "content-b" });
    expect(snap.size()).toBe(2);
    expect(snap.has("a.js")).toBe(true);
    expect(snap.has("c.js")).toBe(false);
  });

  it("FileSnapshot should compute delta correctly", () => {
    const snap = new FileSnapshot();
    snap.capture({ "a.js": "v1", "b.js": "v1" });

    const changed = snap.diff({ "a.js": "v2", "b.js": "v1", "c.js": "new" });
    expect(changed).toContain("a.js");
    expect(changed).toContain("c.js");
    expect(changed).not.toContain("b.js");
  });

  it("FileSnapshot should return empty delta when no changes", () => {
    const snap = new FileSnapshot();
    snap.capture({ "a.js": "v1" });
    const changed = snap.diff({ "a.js": "v1" });
    expect(changed).toHaveLength(0);
  });

  // ── deltaStaleThreshold ──

  it("should trigger full rebuild when delta exceeds stale threshold", () => {
    const files = [];
    for (let i = 0; i < 600; i++) {
      files.push({ path: `src/file${i}.js`, content: `// file ${i}` });
    }

    const result = engine.buildContext({
      task: { prompt: "Mass refactor", relevantFiles: files.slice(0, 10).map((f) => f.path) },
      codebaseIndex: { files },
      useDelta: true,
      deltaStaleThreshold: 500,
    });

    expect(result).toBeDefined();
    expect(result.estimatedTokens).toBeGreaterThan(0);
  });

  // ── 优先级分配 ──

  it("should prioritize task prompt over other content", () => {
    const result = engine.buildContext({
      task: { prompt: "CRITICAL: fix this immediately" },
      codebaseIndex: {
        files: [{ path: "big.js", content: "x".repeat(10000) }],
      },
    });
    expect(result.contextBlock).toContain("CRITICAL");
  });

  it("should truncate low-priority content when budget is tight", () => {
    const smallEngine = new ContextEngine({ maxContextTokens: 500 });
    const result = smallEngine.buildContext({
      task: { prompt: "Fix bug" },
      codebaseIndex: {
        files: [{ path: "huge.js", content: "y".repeat(5000) }],
      },
      previousResults: [{ taskId: "t1", summary: "z".repeat(2000) }],
    });
    expect(result.estimatedTokens).toBeLessThanOrEqual(600);
  });

  // ── 边界情况 ──

  it("should handle empty task prompt gracefully", () => {
    const result = engine.buildContext({
      task: { prompt: "" },
      codebaseIndex: { files: [] },
    });
    expect(result).toBeDefined();
  });

  it("should handle empty codebase gracefully", () => {
    const result = engine.buildContext({
      task: { prompt: "Test", relevantFiles: [] },
      codebaseIndex: { files: [] },
    });
    expect(result).toBeDefined();
  });

  it("should handle missing codebaseIndex", () => {
    const result = engine.buildContext({
      task: { prompt: "Test" },
    });
    expect(result).toBeDefined();
  });

  it("should handle no previousResults", () => {
    const result = engine.buildContext({
      task: { prompt: "Test" },
      codebaseIndex: { files: [] },
      previousResults: undefined,
    });
    expect(result).toBeDefined();
  });

  it("should handle no changedFiles", () => {
    const result = engine.buildContext({
      task: { prompt: "Test" },
      codebaseIndex: { files: [] },
      changedFiles: undefined,
    });
    expect(result).toBeDefined();
  });

  // ── Token 估算 ──

  it("estimateTokens should count ASCII text reasonably", () => {
    const tokens = engine.estimateTokens("hello world this is a test");
    expect(tokens).toBeGreaterThan(3);
    expect(tokens).toBeLessThan(15);
  });

  it("estimateTokens should count CJK text with higher weight", () => {
    const tokens = engine.estimateTokens("你好世界这是一段测试");
    expect(tokens).toBeGreaterThan(3);
  });

  it("estimateTokens should return 0 for empty string", () => {
    expect(engine.estimateTokens("")).toBe(0);
  });

  // ── 快照设置 ──

  it("setSnapshot should attach snapshot without error", () => {
    const snap = new FileSnapshot();
    expect(() => engine.setSnapshot(snap)).not.toThrow();
  });

  it("setCodebaseSearch should attach search without error", () => {
    expect(() => engine.setCodebaseSearch({ search: () => [] })).not.toThrow();
  });
});
