import { describe, expect, it, vi } from "vitest";
import { createAgentToolRegistry } from "../claude-code-patterns/agentToolRegistry.js";
import { buildTool, createInputSchema } from "../claude-code-patterns/toolCore.js";
import { executeToolCalls } from "../providers/toolCallingAdapter.js";
import {
  createToolPermissionContext,
  hasUsablePermissionChecker,
  HIGH_RISK_AGENT_TOOLS,
  shouldRegisterAgentTool,
} from "./agentToolExecutionPolicy.ts";

describe("agent tool execution policy", () => {
  it("recognizes only callable permission checkers", () => {
    expect(hasUsablePermissionChecker(null)).toBe(false);
    expect(hasUsablePermissionChecker({ check: true })).toBe(false);
    expect(hasUsablePermissionChecker({ check() {} })).toBe(true);
  });

  it.each(HIGH_RISK_AGENT_TOOLS)("keeps %s disabled without both opt-in and a checker", (toolName) => {
    expect(shouldRegisterAgentTool({ toolName, enableHighRiskTools: false, permissionChecker: { check() {} } })).toBe(false);
    expect(shouldRegisterAgentTool({ toolName, enableHighRiskTools: true, permissionChecker: null })).toBe(false);
    expect(shouldRegisterAgentTool({ toolName, enableHighRiskTools: true, permissionChecker: { check() {} } })).toBe(true);
  });

  it("fails closed when a registry has no permission checker", async () => {
    const registry = createAgentToolRegistry({ workingDirectory: process.cwd() });
    expect(registry.getTool("shell_exec")).toBeNull();
    expect(registry.getTool("code_run")).toBeNull();
    expect(registry.getTool("web_fetch")).toBeNull();
    expect(registry.getTool("git_push")).toBeNull();
    expect(registry.getTool("git_create_pr")).toBeNull();

    const result = await registry.executeTool("file_read", { file_path: "package.json" });
    expect(result).toMatchObject({
      status: "denied",
      code: "TOOL_PERMISSION_CHECKER_REQUIRED",
    });
  });

  it("registers high-risk tools only with explicit opt-in and forwards shell command context", async () => {
    const check = vi.fn(() => ({ allowed: false, reason: "approval required" }));
    const registry = createAgentToolRegistry({
      workingDirectory: process.cwd(),
      enableHighRiskTools: true,
      permissionChecker: { check },
    });
    expect(registry.getTool("shell_exec")).not.toBeNull();
    expect(registry.getTool("code_run")).not.toBeNull();
    expect(registry.getTool("web_fetch")).not.toBeNull();
    expect(registry.getTool("git_push")).not.toBeNull();
    expect(registry.getTool("git_create_pr")).not.toBeNull();

    const result = await registry.executeTool("shell_exec", { command: "echo guarded" });
    expect(result).toMatchObject({ status: "denied", permission: "shell:exec" });
    expect(check).toHaveBeenCalledWith("shell:exec", expect.objectContaining({
      toolName: "shell_exec",
      command: "echo guarded",
    }));
  });

  it("does not copy arbitrary parameters into permission context", () => {
    expect(createToolPermissionContext({
      toolName: "file_write",
      params: { content: "secret", file_path: "safe.txt" },
      isReadOnly: false,
    })).toEqual({ toolName: "file_write", isReadOnly: false });
  });

  it("never shares permission-bearing read results through the registry cache", async () => {
    const check = vi.fn(() => ({ allowed: true }));
    const registry = createAgentToolRegistry({
      workingDirectory: process.cwd(),
      permissionChecker: { check },
    });
    await registry.executeTool("file_read", { file_path: "package.json" });
    await registry.executeTool("file_read", { file_path: "package.json" });
    expect(check).toHaveBeenCalledTimes(2);
    expect(registry.getHealth().cacheSize).toBe(0);
  });

  it("requires the trusted durable gate, stable key, and configured fence for irreversible tools", async () => {
    const execute = vi.fn(async (_params, context) => {
      await context.commitExternalEffect();
      return { status: "success" };
    });
    const irreversibleTool = buildTool({
      name: "external_test",
      description: "Test irreversible effect",
      inputSchema: createInputSchema({ value: { type: "string" } }, ["value"]),
      requiredPermissions: [],
      isReadOnly: false,
      externalEffectType: "test:external",
      externalEffectRequiresFence: true,
      execute,
    });

    const noGate = createAgentToolRegistry({ workingDirectory: process.cwd() });
    noGate.registerTool(irreversibleTool);
    await expect(noGate.executeTool("external_test", { value: "one" }, {
      externalEffectKey: "session:call-1",
    })).resolves.toMatchObject({
      status: "denied",
      code: "TOOL_EXTERNAL_EFFECT_GATE_REQUIRED",
    });
    expect(execute).not.toHaveBeenCalled();

    const commit = vi.fn(async () => {});
    const reserve = vi.fn(async (_input: Record<string, any>) => ({ commit }));
    const assertActive = vi.fn(async () => true);
    const guarded = createAgentToolRegistry({
      workingDirectory: process.cwd(),
      externalEffectGate: { reserve },
      externalEffectFence: { fencingToken: "17", assertActive },
      externalEffectTenantId: "tenant-a",
    });
    guarded.registerTool(irreversibleTool);

    await expect(guarded.executeTool("external_test", { value: "one" }, {
      externalEffectKey: "session:call-1",
      // A caller-provided fence must not replace the trusted configured fence.
      externalEffectFence: { assertActive: vi.fn(async () => false) },
    })).resolves.toMatchObject({ status: "success" });
    expect(reserve).toHaveBeenCalledWith(expect.objectContaining({
      route: "/agent-tools/external_test",
      tenantId: "tenant-a",
      effectType: "test:external",
      fenceRequired: true,
      effectKeyHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      payloadFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
      fenceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
    }));
    const reservationInput = reserve.mock.calls[0]?.[0];
    expect(reservationInput).toBeDefined();
    await reservationInput!.assertFence("commit");
    expect(assertActive).toHaveBeenCalledWith("commit");
    expect(commit).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
  });

  it("fails before reservation when an irreversible tool lacks a stable key or trusted fence", async () => {
    const reserve = vi.fn(async (_input: Record<string, any>) => ({ commit: async () => {} }));
    const registry = createAgentToolRegistry({
      workingDirectory: process.cwd(),
      externalEffectGate: { reserve },
    });
    registry.registerTool(buildTool({
      name: "external_missing_context",
      description: "Test missing irreversible context",
      inputSchema: createInputSchema({}),
      requiredPermissions: [],
      externalEffectType: "test:external",
      externalEffectRequiresFence: true,
      execute: vi.fn(),
    }));

    await expect(registry.executeTool("external_missing_context", {})).resolves.toMatchObject({
      code: "TOOL_EXTERNAL_EFFECT_KEY_REQUIRED",
    });
    await expect(registry.executeTool("external_missing_context", {}, {
      externalEffectKey: "session:call-2",
    })).resolves.toMatchObject({
      code: "TOOL_EXTERNAL_EFFECT_FENCE_REQUIRED",
    });
    expect(reserve).not.toHaveBeenCalled();
  });

  it("reports an external-effect denial as a failed tool result", async () => {
    const registry = createAgentToolRegistry({ workingDirectory: process.cwd() });
    registry.registerTool(buildTool({
      name: "external_denied_result",
      description: "Test denial signaling",
      inputSchema: createInputSchema({}),
      requiredPermissions: [],
      externalEffectType: "test:external",
      externalEffectRequiresFence: true,
      execute: vi.fn(),
    }));

    const results = await executeToolCalls([{
      id: "call-1",
      name: "external_denied_result",
      arguments: {},
    }], registry, { sessionId: "session-1" });
    const result = results[0] as any;
    expect(result._meta).toMatchObject({
      toolName: "external_denied_result",
      isError: true,
    });
    expect(JSON.parse(result.content)).toMatchObject({
      status: "denied",
      code: "TOOL_EXTERNAL_EFFECT_GATE_REQUIRED",
    });
  });

  it.each([
    "git push origin feature",
    "gh pr create --title test --body test",
    "pnpm publish",
    "docker push example/image:tag",
    "kubectl apply -f deployment.yaml",
    "curl https://hooks.example/side-effect",
    "run-an-operator-script --mode unknown",
  ])("prevents shell bypass of the external-effect fence: %s", async (command) => {
    const reserve = vi.fn();
    const registry = createAgentToolRegistry({
      workingDirectory: process.cwd(),
      enableHighRiskTools: true,
      permissionChecker: { check: vi.fn(() => ({ allowed: true })) },
      externalEffectGate: { reserve },
    });

    await expect(registry.executeTool("shell_exec", { command }, {
      externalEffectKey: `shell:${command}`,
      // Caller-provided proof is intentionally ignored.
      externalEffectFence: { assertActive: vi.fn(async () => true) },
    })).resolves.toMatchObject({
      status: "denied",
      code: "TOOL_EXTERNAL_EFFECT_FENCE_REQUIRED",
    });
    expect(reserve).not.toHaveBeenCalled();
  });
});
