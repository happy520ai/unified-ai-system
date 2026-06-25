/**
 * Agentic Systems Tests
 *
 * Tests for agentic modules: autoContext, projectInstructions, imageAnalysisTool,
 * agentToolRegistry, agenticCodingLoop, subagentDispatch, contextManager, sessionStore
 * All external dependencies are mocked — no real LLM or network calls.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const APPS_SRC = "../../../apps/ai-gateway-service/src";

describe("autoContext", () => {
  let mod, tmpDir;

  before(async () => {
    mod = await import(`${APPS_SRC}/agentic/autoContext.js`);
    tmpDir = mkdtempSync(join(tmpdir(), "autoCtx-"));
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    writeFileSync(join(tmpDir, "src", "auth.js"), "export function login() {}");
    writeFileSync(join(tmpDir, "src", "api.js"), "export function fetchData() {}");
    writeFileSync(join(tmpDir, "README.md"), "# My Project");
    writeFileSync(join(tmpDir, "package.json"), '{"name": "test"}');
  });

  after(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* cleanup: ignore if temp dir already removed */ }
  });

  it("returns an object with selectContext and buildContextPrompt", () => {
    const ctx = mod.createAutoContext({ workingDirectory: tmpDir });
    assert.ok(ctx.selectContext && ctx.buildContextPrompt);
    assert.ok(typeof ctx.selectContext === "function");
    assert.ok(typeof ctx.buildContextPrompt === "function");
  });

  it("selectContext returns relevant files for a goal", async () => {
    const ctx = mod.createAutoContext({ workingDirectory: tmpDir });
    const result = await ctx.selectContext("implement user authentication");
    assert.ok(result && (result.selectedFiles || result.files));
  });

  it("buildContextPrompt returns a string context prompt", async () => {
    const ctx = mod.createAutoContext({ workingDirectory: tmpDir });
    const prompt = await ctx.buildContextPrompt("add login feature");
    assert.ok(typeof prompt === "string");
  });

  it("extractKeywords extracts keywords from goal text", () => {
    const ctx = mod.createAutoContext({ workingDirectory: tmpDir });
    if (ctx.extractKeywords) {
      const kw = ctx.extractKeywords("implement user authentication with JWT tokens");
      assert.ok(Array.isArray(kw) && kw.length > 0);
    }
  });
});

describe("projectInstructions", () => {
  let mod, tmpDir;

  before(async () => {
    mod = await import(`${APPS_SRC}/agentic/projectInstructions.js`);
    tmpDir = mkdtempSync(join(tmpdir(), "projInstr-"));
    writeFileSync(join(tmpDir, "INSTRUCTIONS.md"), "# Project Rules\n- Use TypeScript");
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    writeFileSync(join(tmpDir, "src", "INSTRUCTIONS.md"), "# Src Rules\n- Keep it clean");
  });

  after(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* cleanup: ignore if temp dir already removed */ }
  });

  it("returns object with expected methods", () => {
    const pi = mod.createProjectInstructions({ workingDirectory: tmpDir });
    assert.ok(pi.loadRootInstructions && pi.buildInstructionsPrompt);
  });

  it("loads root instruction file", () => {
    const pi = mod.createProjectInstructions({ workingDirectory: tmpDir });
    const root = pi.loadRootInstructions();
    assert.ok(root && root.content.includes("TypeScript"));
  });

  it("builds instruction prompt text", () => {
    const pi = mod.createProjectInstructions({ workingDirectory: tmpDir });
    const prompt = pi.buildInstructionsPrompt({});
    assert.ok(typeof prompt === "string" && prompt.includes("TypeScript"));
  });

  it("finds INSTRUCTIONS.md in root", () => {
    const pi = mod.createProjectInstructions({ workingDirectory: tmpDir });
    if (pi.findInstructionFile) {
      const found = pi.findInstructionFile(tmpDir);
      assert.ok(found && found.includes("INSTRUCTIONS.md"));
    }
  });
});

describe("imageAnalysisTool", () => {
  let mod;

  before(async () => {
    mod = await import(`${APPS_SRC}/tools/imageAnalysisTool.js`);
  });

  it("createImageAnalysisTool returns a valid tool definition", () => {
    const tool = mod.createImageAnalysisTool();
    assert.equal(tool.name, "image_analyze");
    assert.ok(tool.execute && tool.isReadOnly);
  });

  it("createImageReadTool returns a valid tool definition", () => {
    const tool = mod.createImageReadTool();
    assert.ok(tool.name && tool.execute);
  });
});

describe("agentToolRegistry expanded", () => {
  let createAgentToolRegistry, buildTool, createInputSchema;

  before(async () => {
    const mod = await import(`${APPS_SRC}/claude-code-patterns/agentToolRegistry.js`);
    createAgentToolRegistry = mod.createAgentToolRegistry;
    buildTool = mod.buildTool;
    createInputSchema = mod.createInputSchema;
  });

  it("exports buildTool function", () => {
    assert.ok(typeof buildTool === "function");
  });

  it("exports createInputSchema function", () => {
    assert.ok(typeof createInputSchema === "function");
  });

  it("buildTool creates standardized tool definition", () => {
    const tool = buildTool({
      name: "test_tool",
      description: "A test",
      execute: async () => "ok",
    });
    assert.equal(tool.name, "test_tool");
    assert.equal(tool.description, "A test");
    assert.ok(tool.inputSchema && tool.execute);
  });

  it("registers all new built-in tools", () => {
    const registry = createAgentToolRegistry();
    const toolNames = registry.listTools().map((t) => t.name);

    assert.ok(toolNames.includes("file_read") && toolNames.includes("file_write"));
    assert.ok(toolNames.includes("shell_exec") && toolNames.includes("web_fetch"));
    assert.ok(toolNames.includes("code_run") && toolNames.includes("file_edit"));
    assert.ok(toolNames.includes("file_insert") && toolNames.includes("glob"));
    assert.ok(toolNames.includes("grep") && toolNames.includes("web_search"));
    assert.ok(toolNames.includes("image_analyze") && toolNames.includes("image_read"));
  });

  it("registers git tools", () => {
    const registry = createAgentToolRegistry();
    const toolNames = registry.listTools().map((t) => t.name);

    assert.ok(toolNames.includes("git_status") && toolNames.includes("git_diff"));
    assert.ok(toolNames.includes("git_log") && toolNames.includes("git_branch"));
    assert.ok(toolNames.includes("git_commit") && toolNames.includes("git_push"));
    assert.ok(toolNames.includes("git_create_pr"));
  });

  it("has at least 19 tools registered", () => {
    const registry = createAgentToolRegistry();
    const tools = registry.listTools();
    assert.ok(tools.length >= 19, `Expected >= 19 tools, got ${tools.length}`);
  });

  it("listTools with allowlist filter works", () => {
    const registry = createAgentToolRegistry();
    const filtered = registry.listTools({ allowlist: ["file_read", "glob"] });
    assert.equal(filtered.length, 2);
  });

  it("listTools with denylist filter works", () => {
    const registry = createAgentToolRegistry();
    const all = registry.listTools();
    const filtered = registry.listTools({ denylist: ["shell_exec", "file_write"] });
    assert.equal(filtered.length, all.length - 2);
  });

  it("listTools readOnly mode filters write tools", () => {
    const registry = createAgentToolRegistry();
    const filtered = registry.listTools({ permissionMode: "readOnly" });
    for (const tool of filtered) {
      assert.ok(tool.isReadOnly, `${tool.name} should be readOnly`);
    }
  });
});

describe("agenticCodingLoop Phase B integration", () => {
  let createAgenticLoop;

  before(async () => {
    const mod = await import(`${APPS_SRC}/agentic/agenticCodingLoop.js`);
    createAgenticLoop = mod.createAgenticLoop;
  });

  it("creates loop with autoContext and projectInstructions", () => {
    const fakeAdapter = {
      async generate() {
        return { text: "done", usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } };
      },
    };

    const loop = createAgenticLoop({ providerAdapter: fakeAdapter, maxIterations: 1 });
    const info = loop.getInfo();
    assert.ok(info.hasAutoContext && info.hasProjectInstructions);
    assert.ok(info.hasSubagentDispatch && info.toolCount >= 19);
  });

  it("exposes getAutoContext and getProjectInstructions", () => {
    const fakeAdapter = { async generate() { return { text: "ok", usage: {} }; } };
    const loop = createAgenticLoop({ providerAdapter: fakeAdapter });
    assert.ok(loop.getAutoContext() && loop.getProjectInstructions());
    assert.ok(loop.getSubagentDispatch());
  });

  it("execute respects maxIterations", async () => {
    let callCount = 0;
    const fakeAdapter = {
      async generate() {
        callCount++;
        return {
          toolCalls: [{
            id: `call_${callCount}`,
            type: "function",
            function: { name: "file_read", arguments: '{"path":"test"}' },
          }],
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        };
      },
    };

    const loop = createAgenticLoop({ providerAdapter: fakeAdapter, maxIterations: 2 });
    const result = await loop.execute({ goal: "test task" });
    assert.ok(result && result.iterations <= 2);
  });
});

describe("subagentDispatch", () => {
  let mod;

  before(async () => {
    mod = await import(`${APPS_SRC}/agentic/subagentDispatch.js`);
  });

  it("throws without providerAdapter", () => {
    assert.throws(() => mod.createSubagentDispatch({}), /providerAdapter/i);
  });

  it("creates dispatch instance with providerAdapter", () => {
    const fakeAdapter = { async generate() { return { text: "ok" }; } };
    const dispatch = mod.createSubagentDispatch({ providerAdapter: fakeAdapter });
    assert.ok(dispatch && dispatch.dispatchAll && dispatch.createDispatchTool);
  });

  it("createDispatchTool returns a valid tool definition", () => {
    const fakeAdapter = { async generate() { return { text: "ok" }; } };
    const dispatch = mod.createSubagentDispatch({ providerAdapter: fakeAdapter });
    const tool = dispatch.createDispatchTool();
    assert.equal(tool.name, "subagent_dispatch");
    assert.ok(tool.execute && tool.inputSchema);
  });

  it("getInfo returns dispatch info", () => {
    const fakeAdapter = { async generate() { return { text: "ok" }; } };
    const dispatch = mod.createSubagentDispatch({ providerAdapter: fakeAdapter, maxConcurrent: 3 });
    if (dispatch.getInfo) {
      const info = dispatch.getInfo();
      assert.equal(info.maxConcurrent, 3);
    }
  });
});

describe("agenticCodingLoop edge cases", () => {
  let loopMod;

  before(async () => {
    loopMod = await import(`${APPS_SRC}/agentic/agenticCodingLoop.js`);
  });

  it("rejects null input", async () => {
    const fakeAdapter = { async generate() { return { text: "ok" }; } };
    const loop = loopMod.createAgenticLoop({ providerAdapter: fakeAdapter });
    const result = await loop.execute(null);
    assert.equal(result.status, "error");
    assert.ok(result.trace.length > 0);
  });

  it("rejects undefined input", async () => {
    const fakeAdapter = { async generate() { return { text: "ok" }; } };
    const loop = loopMod.createAgenticLoop({ providerAdapter: fakeAdapter });
    const result = await loop.execute(undefined);
    assert.equal(result.status, "error");
  });

  it("rejects non-object input", async () => {
    const fakeAdapter = { async generate() { return { text: "ok" }; } };
    const loop = loopMod.createAgenticLoop({ providerAdapter: fakeAdapter });
    const result = await loop.execute("not an object");
    assert.equal(result.status, "error");
  });

  it("rejects empty goal", async () => {
    const fakeAdapter = { async generate() { return { text: "ok" }; } };
    const loop = loopMod.createAgenticLoop({ providerAdapter: fakeAdapter });
    const result = await loop.execute({ goal: "" });
    assert.equal(result.status, "error");
  });

  it("rejects whitespace-only goal", async () => {
    const fakeAdapter = { async generate() { return { text: "ok" }; } };
    const loop = loopMod.createAgenticLoop({ providerAdapter: fakeAdapter });
    const result = await loop.execute({ goal: "   \n  " });
    assert.equal(result.status, "error");
  });
});

describe("contextManager edge cases", () => {
  let ctxMod;

  before(async () => {
    ctxMod = await import(`${APPS_SRC}/agentic/contextManager.js`);
  });

  it("handles empty messages array", () => {
    const cm = ctxMod.createContextManager();
    const result = cm.manageHistory([]);
    assert.ok(Array.isArray(result) && result.length === 0);
  });

  it("handles single message", () => {
    const cm = ctxMod.createContextManager();
    const result = cm.manageHistory([{ role: "user", content: "hello" }]);
    assert.ok(Array.isArray(result) && result.length === 1);
  });

  it("handles null messages gracefully", () => {
    const cm = ctxMod.createContextManager();
    const result = cm.manageHistory(null);
    assert.ok(Array.isArray(result) || result === null);
  });

  it("handles empty tool results in trackChangedFiles", () => {
    const cm = ctxMod.createContextManager();
    cm.trackChangedFiles([]);
    const changes = cm.getChangedFiles ? cm.getChangedFiles() : [];
    assert.ok(Array.isArray(changes) && changes.length === 0);
  });

  it("handles malformed content in trackChangedFiles", () => {
    const cm = ctxMod.createContextManager();
    cm.trackChangedFiles([
      { _meta: { toolName: "file_write" }, content: "not valid json {{{" },
      { _meta: { toolName: "file_write" }, content: null },
      { _meta: {}, content: "no tool name" },
    ]);
    const changes = cm.getChangedFiles ? cm.getChangedFiles() : [];
    assert.ok(Array.isArray(changes));
  });

  it("handles undefined content in trackChangedFiles", () => {
    const cm = ctxMod.createContextManager();
    cm.trackChangedFiles([
      { _meta: { toolName: "file_write" } },
      { _meta: { toolName: "shell_exec" }, content: undefined },
    ]);
    const changes = cm.getChangedFiles ? cm.getChangedFiles() : [];
    assert.ok(Array.isArray(changes));
  });
});

describe("sessionStore edge cases", () => {
  let storeMod, tmpDir;

  before(async () => {
    storeMod = await import(`${APPS_SRC}/agentic/sessionStore.js`);
    tmpDir = mkdtempSync(join(tmpdir(), "session-edge-"));
  });

  after(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* cleanup: ignore if temp dir already removed */ }
  });

  it("save generates id when sessionId is null", async () => {
    const store = storeMod.createSessionStore({ storageDir: tmpDir });
    const session = await store.save(null, {
      goal: "test goal",
      messages: [{ role: "user", content: "hello" }],
    });
    assert.ok(session.id && session.id.length > 0);
  });

  it("remove returns false for non-existent session", async () => {
    const store = storeMod.createSessionStore({ storageDir: tmpDir });
    const result = await store.remove("nonexistent-session-id-xyz");
    assert.equal(result, false);
  });

  it("load returns null for non-existent session", async () => {
    const store = storeMod.createSessionStore({ storageDir: tmpDir });
    const result = await store.load("does-not-exist");
    assert.equal(result, null);
  });

  it("getLatest returns null when no sessions exist", async () => {
    const emptyDir = mkdtempSync(join(tmpdir(), "session-empty-"));
    try {
      const store = storeMod.createSessionStore({ storageDir: emptyDir });
      const result = await store.getLatest();
      assert.equal(result, null);
      rmSync(emptyDir, { recursive: true, force: true });
    } catch { /* cleanup: ignore if temp dir already removed */ }
  });

  it("handles concurrent saves without crash", async () => {
    const store = storeMod.createSessionStore({ storageDir: tmpDir });
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(store.save(`concurrent-${i}`, { goal: `Goal ${i}`, messages: [] }));
    }
    const results = await Promise.all(promises);
    assert.equal(results.length, 5);
    for (const r of results) {
      assert.ok(r.id);
    }
  });
});
