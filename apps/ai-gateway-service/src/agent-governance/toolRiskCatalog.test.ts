import { describe, expect, it } from "vitest";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createBuiltInTools } from "../claude-code-patterns/developerTools.js";
import { createGitTools } from "../tools/gitTools.js";
import { createLspTools } from "../tools/lspTool.js";
import { createToolRiskCatalog } from "./toolRiskCatalog.ts";
import { createAgentGovernanceService } from "./agentGovernanceService.ts";
import { createAgentGovernanceToolProxy } from "./toolProxy.ts";

describe("Agent Governance tool-risk catalog", () => {
  it("classifies canonical Workforce execution as an allowed write-capable subagent creator", () => {
    expect(createToolRiskCatalog().lookup("workforce_execute")).toMatchObject({
      name: "workforce_execute",
      actionType: "write",
      riskTraits: ["subagent_creator", "write_capable"],
      riskLevel: "high",
      defaultDecision: "allow",
      credentialMode: "server_side",
    });
  });

  it("covers every statically registered Agent runtime tool by its exact name", () => {
    const runtimeNames = new Set([
      ...Object.keys(createBuiltInTools(process.cwd())),
      ...(createGitTools({ workingDirectory: process.cwd() }) as any[]).map((tool) => tool.name),
      ...((createLspTools({ workingDirectory: process.cwd() }) as any).tools as any[]).map((tool) => tool.name),
    ]);
    const catalog = createToolRiskCatalog();
    const missing = [...runtimeNames].filter((name) => catalog.lookup(name) === null).sort();
    expect(missing).toEqual([]);
  });

  it("reserves native recovery and its aliases against custom risk downgrades while retaining ordinary registration", () => {
    const name = "workforce_external_runner_recover", catalog = createToolRiskCatalog(), recovery = catalog.lookup(name)!;
    expect(recovery).toMatchObject({ name, actionType: "write", riskTraits: ["code_execution"], riskLevel: "critical",
      defaultDecision: "allow", credentialMode: "server_side" });
    expect(Object.isFrozen(recovery)).toBe(true); expect(Object.isFrozen(recovery.riskTraits)).toBe(true);
    const readOnly = { name, actionType: "read" as const, riskTraits: [], riskLevel: "low" as const, defaultDecision: "allow" as const, credentialMode: "server_side" as const };
    for (const toolName of [name, name + ":child", name + ":child:other"]) {
      expect(() => catalog.register({ ...readOnly, name: toolName })).toThrow("server-owned");
      expect(() => createToolRiskCatalog({ extra: [{ ...readOnly, name: toolName }] })).toThrow("server-owned");
      if (toolName !== name) expect(catalog.lookup(toolName)).toBeNull();
    }
    catalog.asMap().set(name, readOnly); expect(catalog.lookup(name)).toBe(recovery);
    catalog.register({ ...readOnly, name: "fixture_read" });
    expect(catalog.lookup("fixture_read:child")).toMatchObject({ name: "fixture_read:child", actionType: "read" });
    expect(catalog.lookup("code_run")?.defaultDecision).toBe("deny");
    expect(catalog.lookup("shell_exec")?.defaultDecision).toBe("deny");
  });

  it("generates actual Agents with native recovery only under an explicit policy and still requires the snapshot capability", async () => {
    const root = await mkdtemp(join(await realpath(tmpdir()), "native-recovery-catalog-"));
    try {
      const now = () => "2026-09-11T00:00:00.000Z", tool = "workforce_external_runner_recover";
      const identity = { tenantId: "native-catalog-tenant", userId: "owner", role: "admin", permissions: ["*"] };
      const service = createAgentGovernanceService({ dataDir: root, now, env: {
        AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "native-catalog-fixture-secret-material", PME_ENTERPRISE_PLATFORM_TENANT_ID: identity.tenantId } });
      const input = { name: "native-recovery-fixture", task: "Inspect the original native task and verify its immutable source snapshot",
        classification: { family: "execution", domain: "general", subclass: "executor" }, requestedTools: ["file_read", tool, "workforce_verify_snapshot"],
        ttlSeconds: 3600, parentAgentId: null, proposedRiskLevel: "low" };
      const stock = await service.generateAgent(input as any, identity);
      expect(stock.grantedTools).not.toContain(tool); expect(stock.grantedTools).not.toContain("workforce_verify_snapshot");
      expect((await service.getEffectivePolicy(stock.agentId, identity.tenantId))?.permissions.canExecuteCode).toBe(false);
      const proxy = createAgentGovernanceToolProxy({ service, now });
      expect((await proxy.enforce({ context: { agentId: stock.agentId, tenantId: identity.tenantId, userId: identity.userId }, toolName: tool, params: {} })).outcome).toBe("deny");
      await service.createPolicyVersion({ policyKey: "execution-family", version: 3, policyType: "family", scopeKey: "execution", content: {
        capabilityCeiling: input.requestedTools, toolRules: Object.fromEntries(input.requestedTools.map(name => [name, "allow"])),
        permissions: { canWrite: true, canExecuteCode: true, canCreateChildren: false, canSendExternalMessage: false } } }, identity);
      await service.activatePolicyVersion("execution-family", 3, identity);
      const enabled = await service.generateAgent(input as any, identity);
      expect(enabled.grantedTools).toContain(tool);
      const effective = await service.getEffectivePolicy(enabled.agentId, identity.tenantId);
      expect(effective?.toolDecisions[tool]).toBe("allow"); expect(effective?.permissions.canExecuteCode).toBe(true);
      expect(effective?.traits).toContain("code_execution"); expect(effective?.riskLevel).toBe("critical");
      const context = { agentId: enabled.agentId, tenantId: identity.tenantId, userId: identity.userId };
      const allowed = await proxy.enforce({ context, toolName: tool, params: { executionId: "original", operationId: "original-operation", agentId: enabled.agentId } });
      expect(allowed.outcome).toBe("allow"); allowed.executionLease?.release();
      const snapshot = await proxy.enforce({ context, toolName: "workforce_verify_snapshot", params: {} });
      expect(snapshot).toMatchObject({ outcome: "deny", code: "WORKFORCE_SNAPSHOT_CAPABILITY_REQUIRED" });
      await expect(service.generateAgent({ ...input, requestedTools: [tool + ":child"] } as any, identity)).rejects.toMatchObject({ name: "ToolUnregistered" });
    } finally {
      expect(await realpath(root)).toBe(root); expect(dirname(root)).toBe(await realpath(tmpdir()));
      await rm(root, { recursive: true, force: true });
    }
  });
});
