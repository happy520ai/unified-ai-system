import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readdir, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createIsolatedCodeRunner } from "./codeRunIsolation.ts";
import { createCodeRunTool } from "./sandboxTools.js";
import { createAgentToolRegistry } from "./agentToolRegistry.js";

const backend = vi.hoisted(() => ({ construct: vi.fn(), run: vi.fn() }));
vi.mock("@unified-ai-system/forge-core", () => ({
  ContainerSandboxBackend: class {
    constructor(options: unknown) { backend.construct(options); }
    run(options: unknown) { return backend.run(options); }
  },
}));

const roots: string[] = [];
const enginePath = process.platform === "win32" ? "C:\\test-engine.exe" : "/test-engine";
const image = `example.invalid/node@sha256:${"a".repeat(64)}`;
const success = () => ({ exitCode: 0, killed: false, cleanupUncertain: false,
  stdout: JSON.stringify({ status: "success", result: "3", logs: [] }) });

async function scratch() {
  const root = await mkdtemp(join(tmpdir(), "code-run-contract-test-"));
  roots.push(root);
  return realpath(root);
}

afterEach(async () => {
  vi.clearAllMocks();
  backend.run.mockReset();
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe("isolated code_run contracts (mock container; no submitted code executes on host)", () => {
  it("refuses an absent backend rather than evaluating a host canary", async () => {
    const run = createIsolatedCodeRunner({ enginePath: "", image: "" });
    expect(await run({ code: "globalThis.__codeRunCanary = true; return 3" })).toMatchObject({
      status: "error", code: "CODE_RUN_ISOLATION_UNAVAILABLE",
    });
    expect((globalThis as Record<string, unknown>).__codeRunCanary).toBeUndefined();
    expect(backend.construct).not.toHaveBeenCalled();
  });

  it("validates bytes, time bounds and trusted configuration before allocation", async () => {
    const run = createIsolatedCodeRunner({ enginePath, image });
    for (const params of [{ code: "" }, { code: "界".repeat(22000) }, { code: "return 3", timeout_ms: 30001 },
      { code: "return 3", timeout_ms: "10" }, { code: "return 3", timeout_ms: 0 }]) {
      expect(await run(params)).toMatchObject({ code: "CODE_RUN_INPUT_INVALID" });
    }
    expect(await createIsolatedCodeRunner({ enginePath: "relative", image })({ code: "return 3" }))
      .toMatchObject({ code: "CODE_RUN_CONFIGURATION_INVALID" });
    expect(backend.construct).not.toHaveBeenCalled();
  });

  it("passes only snippet files to a read-only, networkless, bounded container and removes them", async () => {
    const root = await scratch();
    const signal = new AbortController().signal;
    backend.run.mockImplementation(async (options) => {
      expect(options).toMatchObject({ command: "node /workspace/runner.cjs", workspaceMode: "ro",
        networkAccess: false, env: {}, timeoutMs: 42, maxMemoryMB: 128, maxOutputBytes: 65536,
        pidsLimit: 32, cpus: 1, signal });
      expect(dirname(dirname(options.workspace))).toBe(root);
      expect((await readdir(options.workspace)).sort()).toEqual(["runner.cjs", "snippet.js"]);
      expect(await readFile(join(options.workspace, "snippet.js"), "utf8")).toBe("return 1 + 2");
      expect(await readFile(join(options.workspace, "runner.cjs"), "utf8")).toContain("/workspace/snippet.js");
      expect(backend.construct).toHaveBeenCalledWith({ enginePath, image,
        workspaceRoots: [options.workspace], allowNetwork: false });
      return success();
    });
    const tool = createCodeRunTool({ enginePath, image, scratchRoot: root });
    expect(await tool.execute({ code: "return 1 + 2", timeout_ms: 42 }, { signal })).toMatchObject({ status: "success", result: "3" });
    expect(await readdir(root)).toEqual([]);
  });

  it.each([
    [{ killed: true, killReason: "timeout (42ms)", exitCode: -1 }, "CODE_RUN_TIMEOUT"],
    [{ killed: true, killReason: "aborted", exitCode: -1 }, "CODE_RUN_CANCELLED"],
    [{ truncated: true }, "CODE_RUN_OUTPUT_LIMIT"],
    [{ exitCode: 1 }, "CODE_RUN_EXECUTION_FAILED"],
    [{ stdout: "bad result" }, "CODE_RUN_EXECUTION_FAILED"],
  ])("reports bounded execution failures without success: %s", async (override, code) => {
    const root = await scratch();
    backend.run.mockResolvedValue({ ...success(), ...override });
    expect(await createIsolatedCodeRunner({ enginePath, image, scratchRoot: root })({ code: "return 3" }))
      .toMatchObject({ status: "error", code });
    expect(await readdir(root)).toEqual([]);
  });

  it("retains temporary inputs when removal cannot be proven", async () => {
    const root = await scratch();
    backend.run.mockRejectedValue(Object.assign(new Error("private engine error"), { cleanupUncertain: true }));
    const result = await createIsolatedCodeRunner({ enginePath, image, scratchRoot: root })({ code: "return 3" });
    expect(result).toMatchObject({ code: "CODE_RUN_CLEANUP_UNCERTAIN", workspaceRetained: true, recoveryRequired: true });
    expect(JSON.stringify(result)).not.toContain("private engine error");
    expect(await readdir(root)).toHaveLength(1);
  });

  it("refuses cancellation before container admission", async () => {
    const controller = new AbortController(); controller.abort();
    expect(await createIsolatedCodeRunner({ enginePath, image })({ code: "return 3" }, { signal: controller.signal }))
      .toMatchObject({ code: "CODE_RUN_CANCELLED" });
    expect(backend.run).not.toHaveBeenCalled();
  });

  it("classifies cancellation during preparation without returning an availability error", async () => {
    const root = await scratch();
    backend.run.mockRejectedValue(Object.assign(new Error("cancelled"), { code: "SANDBOX_ABORTED", cleanupUncertain: false }));
    expect(await createIsolatedCodeRunner({ enginePath, image, scratchRoot: root })({ code: "return 3" }))
      .toMatchObject({ code: "CODE_RUN_CANCELLED" });
    expect(await readdir(root)).toEqual([]);
  });

  it("enabled registry uses only captured server configuration", async () => {
    const root = await scratch(); backend.run.mockResolvedValue(success());
    const registry = createAgentToolRegistry({ highRiskToolAllowlist: ["code_run"],
      permissionChecker: { check: () => ({ allowed: true }) },
      codeRunIsolation: { enginePath, image, scratchRoot: root } });
    const result = await registry.executeTool("code_run", { code: "return 3" }, {
      enginePath: "attacker", image: "untrusted", workspace: process.cwd(),
    });
    expect(result).toMatchObject({ status: "success", result: "3" });
    expect(backend.construct).toHaveBeenCalledWith(expect.objectContaining({ enginePath, image }));
    expect(await readdir(root)).toEqual([]);
  });

  it("reserves code_run aliases even when the builtin is disabled", () => {
    const registry = createAgentToolRegistry();
    for (const name of ["code_run", "CODE_RUN", "code-run", "ｃｏｄｅ＿ｒｕｎ", "code\u200brun"]) {
      expect(registry.registerTool({ name, execute: () => { throw new Error("must not run"); } }))
        .toMatchObject({ code: "TOOL_BUILTIN_OVERRIDE_BLOCKED" });
    }
    expect(registry.getTool("code_run")).toBeNull();
  });
});
