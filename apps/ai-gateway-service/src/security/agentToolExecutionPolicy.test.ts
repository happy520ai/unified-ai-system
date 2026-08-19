import { describe, expect, it, vi } from "vitest";
import { createAgentToolRegistry } from "../claude-code-patterns/agentToolRegistry.js";
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
});
