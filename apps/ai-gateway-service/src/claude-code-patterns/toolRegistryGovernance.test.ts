import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { computeArgumentsHash } from "@unified-ai-system/policy-engine";
import { createAgentToolRegistry } from "./toolRegistryEngine.js";

describe("agent tool registry governance boundary", () => {
  it("marks a committed external effect uncertain when terminal outcome audit fails", async () => {
    let committedEffects = 0;
    const commit = vi.fn(async () => { committedEffects += 1; });
    const enforceResult = vi.fn(async () => {
      throw Object.assign(new Error("outcome audit unavailable"), { code: "GOVERNANCE_AUDIT_REQUIRED" });
    });
    const recordOutcome = vi.fn(async () => {
      throw new Error("outcome audit unavailable");
    });
    const registry = createAgentToolRegistry({
      governanceRequired: true,
      governanceToolProxy: {
        enforce: vi.fn(async () => ({
          outcome: "allow",
          policy: {
            requirements: { auditRequired: true },
            mandatory: { auditRequired: true },
            permissions: { canWrite: true },
            limits: {},
            scope: {},
          },
        })),
        enforceResult,
        recordOutcome,
      },
      permissionChecker: { check: vi.fn(async () => ({ allowed: true })) },
      externalEffectGate: { reserve: vi.fn(async () => ({ commit })) },
      externalEffectFence: { fingerprint: "a".repeat(64), assertActive: vi.fn(async () => true) },
      externalEffectTenantId: "tenant_a",
    });
    expect(registry.registerTool({
      name: "governed_effect_probe",
      description: "committed effect audit probe",
      requiredPermissions: ["file:write"],
      isReadOnly: false,
      externalEffectType: "test:write",
      externalEffectRequiresFence: true,
      inputSchema: { type: "object", properties: {}, required: [] },
      execute: vi.fn(async (_params, context) => {
        await context.commitExternalEffect();
        return { status: "success" };
      }),
    })).toMatchObject({ status: "success" });

    const result = await registry.executeTool("governed_effect_probe", {}, {
      agentGovernance: { agentId: "agt_effect", tenantId: "tenant_a", requestId: "effect-request" },
      externalEffectKey: "effect-once",
    });
    expect(committedEffects).toBe(1);
    expect(result).toMatchObject({
      status: "error",
      code: "TOOL_EXTERNAL_EFFECT_OUTCOME_UNCERTAIN",
      outcomeUnknown: true,
      retrySafe: false,
      reconciliation: {
        required: true,
        effectType: "test:write",
        effectKeyHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
        toolName: "governed_effect_probe",
        executionId: expect.any(String),
      },
    });
  });

  it("marks a completed built-in file write uncertain when terminal outcome audit fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "governed-file-outcome-"));
    const release = vi.fn();
    try {
      const registry = createAgentToolRegistry({
        workingDirectory: root,
        governanceRequired: true,
        governanceToolProxy: {
          enforce: vi.fn(async () => ({
            outcome: "allow",
            policy: {
              requirements: { auditRequired: true },
              mandatory: { auditRequired: true },
              permissions: { canWrite: true },
              limits: {},
              scope: {},
            },
            executionLease: { release },
          })),
          enforceResult: vi.fn(async () => ({
            verdict: "replace",
            code: "GOVERNED_RESULT_REPLACED",
            result: { status: "denied", code: "GOVERNED_RESULT_REPLACED" },
          })),
          recordOutcome: vi.fn(async () => {
            throw new Error("outcome audit unavailable");
          }),
        },
        permissionChecker: { check: vi.fn(async () => ({ allowed: true })) },
      });

      const result = await registry.executeTool("file_write", {
        file_path: "result.txt",
        content: "written exactly once",
      }, {
        agentGovernance: {
          agentId: "agt_file_effect",
          tenantId: "tenant_a",
          requestId: "file-effect-request",
        },
      });

      expect(await readFile(join(root, "result.txt"), "utf8")).toBe("written exactly once");
      expect(result).toMatchObject({
        status: "error",
        code: "TOOL_EXTERNAL_EFFECT_OUTCOME_UNCERTAIN",
        outcomeUnknown: true,
        retrySafe: false,
        reconciliation: {
          required: true,
          effectType: "local-tool-write",
          toolName: "file_write",
          parametersHash: computeArgumentsHash({
            file_path: "result.txt",
            content: "written exactly once",
          }),
          executionId: expect.any(String),
        },
      });
      expect(release).toHaveBeenCalledOnce();
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it("fails closed when a governed registry call omits agent identity", async () => {
    const enforce = vi.fn();
    const registry = createAgentToolRegistry({
      governanceRequired: true,
      governanceToolProxy: { enforce },
      permissionChecker: { check: vi.fn(async () => ({ allowed: true })) },
    });
    const result = await registry.executeTool("file_read", { file_path: "README.md" });
    expect(result).toMatchObject({
      status: "denied",
      code: "AGENT_GOVERNANCE_CONTEXT_REQUIRED",
    });
    expect(enforce).not.toHaveBeenCalled();
  });

  it("redacts governed tool output and never shares it through the legacy cache", async () => {
    const release = vi.fn();
    const execute = vi.fn(async () => ({
      status: "success",
      public: "ok",
      apiToken: "sensitive",
      content: "Authorization: Bearer live-secret-token-value",
      output: "token=marker-value",
      nested: { private_key: "key-material", keep: 1 },
    }));
    const enforce = vi.fn(async () => ({
      outcome: "allow",
      policy: {
        requirements: { outputRedactionRequired: true },
        scope: { deniedOutputFields: ["private_key"] },
      },
      executionLease: { release },
    }));
    const registry = createAgentToolRegistry({
      governanceRequired: true,
      governanceToolProxy: { enforce },
      permissionChecker: { check: vi.fn(async () => ({ allowed: true })) },
    });
    registry.registerTool({
      name: "governed_output_probe",
      description: "governed output probe",
      requiredPermissions: ["file:read"],
      isReadOnly: true,
      readOnlyAttested: true,
      inputSchema: { type: "object", properties: {}, required: [] },
      execute,
    });
    const context = { agentGovernance: { agentId: "agt_probe", tenantId: "tenant_a" } };
    const first = await registry.executeTool("governed_output_probe", {}, context);
    const second = await registry.executeTool("governed_output_probe", {}, context);
    expect(first).toMatchObject({
      status: "success",
      public: "ok",
      apiToken: "***REDACTED***",
      nested: { private_key: "***REDACTED***", keep: 1 },
    });
    expect(JSON.stringify(first)).not.toContain("live-secret-token-value");
    expect(JSON.stringify(first)).not.toContain("marker-value");
    expect(second).toEqual(first);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(enforce).toHaveBeenCalledTimes(2);
    expect(release).toHaveBeenCalledTimes(2);
  });

  it("omits depth and node-budget overflow from governed results and execution logs", async () => {
    const deepResult: Record<string, unknown> = {};
    let resultCursor = deepResult;
    for (let index = 0; index < 15; index += 1) {
      const next: Record<string, unknown> = {};
      resultCursor.next = next;
      resultCursor = next;
    }
    resultCursor.value = "DEPTH_RESULT_CANARY";
    const wideResult: Record<string, unknown> = {};
    for (let index = 0; index < 10_050; index += 1) wideResult[`field_${index}`] = index;
    wideResult.zzzCanary = "BUDGET_RESULT_CANARY";

    const deepParam: Record<string, unknown> = {};
    let paramCursor = deepParam;
    for (let index = 0; index < 11; index += 1) {
      const next: Record<string, unknown> = {};
      paramCursor.next = next;
      paramCursor = next;
    }
    paramCursor.value = "DEPTH_LOG_CANARY";
    const wideParam: Record<string, unknown> = {};
    for (let index = 0; index < 2_050; index += 1) wideParam[`field_${index}`] = index;
    wideParam.zzzCanary = "BUDGET_LOG_CANARY";

    const registry = createAgentToolRegistry({
      governanceRequired: true,
      governanceToolProxy: {
        enforce: vi.fn(async () => ({
          outcome: "allow",
          policy: { requirements: { outputRedactionRequired: true } },
        })),
      },
    });
    registry.registerTool({
      name: "governed_budget_probe",
      description: "governed sanitizer budget probe",
      requiredPermissions: ["file:read"],
      isReadOnly: true,
      readOnlyAttested: true,
      inputSchema: {
        type: "object",
        properties: { deep: { type: "object" }, wide: { type: "object" } },
        required: [],
      },
      execute: vi.fn(async () => ({ status: "success", deep: deepResult, wide: wideResult })),
    });
    const result = await registry.executeTool("governed_budget_probe", {
      deep: deepParam,
      wide: wideParam,
    }, {
      agentGovernance: { agentId: "agt_budget", tenantId: "tenant_a" },
    });
    const serializedResult = JSON.stringify(result);
    const serializedLog = JSON.stringify(registry.getExecutionLog());
    expect(serializedResult).toContain("[output omitted: depth limit exceeded]");
    expect(serializedResult).toContain("[output omitted: node budget exceeded]");
    expect(serializedResult).not.toContain("DEPTH_RESULT_CANARY");
    expect(serializedResult).not.toContain("BUDGET_RESULT_CANARY");
    expect(serializedLog).toContain("[value omitted: depth limit exceeded]");
    expect(serializedLog).toContain("[value omitted: node budget exceeded]");
    expect(serializedLog).not.toContain("DEPTH_LOG_CANARY");
    expect(serializedLog).not.toContain("BUDGET_LOG_CANARY");
  });

  it("redacts unsafe property keys from results, logs and event summaries", async () => {
    const eventBus = { emit: vi.fn() };
    const resultKey = `Authorization: Bearer ${"R".repeat(24)}`;
    const toolResult = Object.create(null) as Record<string, unknown>;
    toolResult.status = "success";
    toolResult[resultKey] = "RESULT_KEY_CANARY";
    Object.defineProperty(toolResult, "constructor", { value: "CONSTRUCTOR_CANARY", enumerable: true });
    Object.defineProperty(toolResult, "__proto__", {
      value: { polluted: "PROTO_CANARY" },
      enumerable: true,
    });
    Object.defineProperty(toolResult, "toJSON", {
      value: () => ({ leaked: "TOJSON_EVENT_CANARY" }),
      enumerable: true,
    });
    const registry = createAgentToolRegistry({
      governanceRequired: true,
      eventBus,
      governanceToolProxy: {
        enforce: vi.fn(async () => ({
          outcome: "allow",
          policy: {
            requirements: { outputRedactionRequired: true },
            mandatory: { credentialsExposedToAgent: false },
            scope: {},
            permissions: {},
          },
        })),
      },
    });
    registry.registerTool({
      name: "governed_key_probe",
      description: "governed key sanitizer probe",
      requiredPermissions: ["file:read"],
      isReadOnly: true,
      readOnlyAttested: true,
      inputSchema: {
        type: "object",
        properties: { probe: { type: "string" } },
        required: ["probe"],
        additionalProperties: false,
      },
      execute: vi.fn(async () => toolResult),
    });
    const result = await registry.executeTool("governed_key_probe", { probe: "safe" }, {
      agentGovernance: { agentId: "agt_key", tenantId: "tenant_a" },
    });
    const allPublicSurfaces = JSON.stringify({
      result,
      log: registry.getExecutionLog(),
      events: eventBus.emit.mock.calls,
    });
    expect(allPublicSurfaces).not.toMatch(/RESULT_KEY_CANARY|CONSTRUCTOR_CANARY|PROTO_CANARY|TOJSON_EVENT_CANARY/u);
    expect(allPublicSurfaces).not.toContain("R".repeat(24));
    expect(allPublicSurfaces).toContain("[redacted-key-");
    expect(Object.getPrototypeOf(result)).toBeNull();
    expect(Object.hasOwn(result as object, "__proto__")).toBe(false);
    expect(Object.hasOwn(result as object, "toJSON")).toBe(false);
  });

  it("blocks a configured governance state root even when it is not named .data", async () => {
    const protectedRoot = resolve(process.cwd(), "state", "agent-governance");
    const registry = createAgentToolRegistry({
      workingDirectory: process.cwd(),
      governanceRequired: true,
      governanceProtectedPaths: [protectedRoot],
      governanceToolProxy: {
        enforce: vi.fn(async () => ({ outcome: "allow", policy: { permissions: {} } })),
      },
    });
    const result = await registry.executeTool("file_read", {
      file_path: resolve(protectedRoot, "secret.key"),
    }, {
      agentGovernance: { agentId: "agt_probe", tenantId: "tenant_a" },
    });
    expect(result).toMatchObject({
      status: "denied",
      code: "AGENT_GOVERNANCE_PROTECTED_RESOURCE",
    });
  });

  it("rejects provider-fabricated tools outside the frozen per-run allowlist before governance", async () => {
    const enforce = vi.fn(async () => ({ outcome: "allow", policy: { permissions: {} } }));
    const registry = createAgentToolRegistry({
      governanceRequired: true,
      governanceToolProxy: { enforce },
    });
    const result = await registry.executeTool("git_status", {}, {
      agentGovernance: { agentId: "agt_probe", tenantId: "tenant_a" },
      runAllowedTools: Object.freeze(["file_read"]),
    });
    expect(result).toMatchObject({
      status: "denied",
      code: "TOOL_NOT_ALLOWED_FOR_RUN",
    });
    expect(enforce).not.toHaveBeenCalled();
  });
});
