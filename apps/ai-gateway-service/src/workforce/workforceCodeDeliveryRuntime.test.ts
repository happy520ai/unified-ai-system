import { createHash, createHmac } from "node:crypto";
import { chmod, mkdir, mkdtemp, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContainerSandboxBackend } from "@unified-ai-system/forge-core";
import { createAgentGovernanceToolProxy, readWorkforceCodeDeliveryToolProxy } from "../agent-governance/toolProxy.ts";
import { createWorkforceCodeDeliveryFactory, isWorkforceCodeDeliveryFactory,
  preflightWorkforceCodeDelivery, runWorkforceCodeDelivery, consumeWorkforceSnapshotCapability, verifyWorkforceCodeSnapshot } from "./workforceCodeDeliveryRuntime.ts";
import { captureApprovedCodeFiles } from "./workforceCodeDeliveryArtifacts.ts";
import { freezeWorkforceCodeDeliveryProfile } from "./workforceCodeDeliveryProfile.ts";
import { assertWorkforceCodeTaskFence, executeWorkforceDag } from "./workforceDagExecutor.ts";
import { createToolRiskCatalog } from "../agent-governance/toolRiskCatalog.ts";
import { freezeGovernedAgentTaskVerificationResult } from "../agentic/governedAgentTaskProfile.ts";

describe("code delivery implementation provenance", () => {
  it("expires the genuine task capability after callback settlement and rejects other bindings or copied callbacks", async () => {
    const agentFence = { assertActive: vi.fn(async () => true) };
    const context = { executionId: "execution", governedAgentId: "agt_fixture", agentRunId: "agr_fixture" };
    const taskQueue = { claimTask: async () => ({ claimToken: "claim", claim: { fencingToken: "fence" } }),
      updateTaskStatus: async () => {}, assertTaskClaimActive: vi.fn(async () => true), completeTask: async () => {} };
    const expected = { executionId: "execution", agentId: "agt_fixture", agentRunId: "agr_fixture", taskId: "task", roleId: "ceo", agentFence };
    let captured: unknown;
    await executeWorkforceDag({ tasks: [{ queueTaskId: "task", roleId: "ceo" }], taskQueue, context, agentExecutionFence: agentFence,
      executeRole: async (_role, taskContext) => {
        captured = taskContext.externalEffectFence;
        for (const key of ["executionId", "agentId", "agentRunId", "taskId", "roleId", "agentFence"]) {
          await expect(assertWorkforceCodeTaskFence(captured, { ...expected, [key]: key === "agentFence" ? {} : "wrong" })).rejects.toMatchObject({ code: "WORKFORCE_CODE_TASK_FENCE_INVALID" });
        }
        await expect(assertWorkforceCodeTaskFence({ ...captured as object }, expected)).rejects.toMatchObject({ code: "WORKFORCE_CODE_TASK_FENCE_INVALID" });
        expect(taskQueue.assertTaskClaimActive).not.toHaveBeenCalled();
        await assertWorkforceCodeTaskFence(captured, expected); return { success: true };
      } });
    await expect(assertWorkforceCodeTaskFence(captured, expected)).rejects.toMatchObject({ code: "WORKFORCE_CODE_TASK_FENCE_INVALID" });
    expect(taskQueue.assertTaskClaimActive).toHaveBeenCalledOnce();
  });

  it("requires the private snapshot capability despite a policy grant, observe mode, JSON or namespace tricks", async () => {
    const policy: any = { agentId: "agt_fixture", expiresAt: "2099-01-01T00:00:00Z", policyHash: "sha256:" + "f".repeat(64),
      grantedTools: ["workforce_verify_snapshot"], toolDecisions: { workforce_verify_snapshot: "allow" },
      permissions: { canWrite: true, canExecuteCode: true }, requirements: {}, limits: {}, scope: {} };
    const reserveUsage = vi.fn(async () => ({ allowed: true }));
    const service: any = { expireAgents: async () => {}, getAgent: async () => ({ status: "ACTIVE" }),
      loadVerifiedPolicy: async () => ({ policy }), emitAudit: async () => {}, reserveUsage };
    for (const mode of ["enforce", "observe"] as const) for (const capability of [undefined, { admitted: true, used: false }]) {
      const proxy = createAgentGovernanceToolProxy({ service, mode });
      const denied = await proxy.enforce({ context: { agentId: "agt_fixture", tenantId: "tenant", userId: "owner" },
        toolName: "workforce_verify_snapshot", params: {}, resourceContext: { workforceSnapshotCapability: capability } });
      expect(denied).toMatchObject({ outcome: "deny", code: "WORKFORCE_SNAPSHOT_CAPABILITY_REQUIRED" });
      expect((await proxy.enforce({ context: { agentId: "agt_fixture", tenantId: "tenant" }, toolName: "workforce_verify_snapshot:child", params: {} })).outcome).toBe("deny");
    }
    expect(reserveUsage).not.toHaveBeenCalled();
    const catalog = createToolRiskCatalog(), baseline = catalog.lookup("workforce_verify_snapshot")!;
    expect(Object.isFrozen(baseline)).toBe(true); expect(catalog.lookup("workforce_verify_snapshot:child")).toBeNull();
    for (const name of ["workforce_verify_snapshot", "workforce_verify_snapshot:child"]) {
      expect(() => catalog.register({ ...baseline, name })).toThrow();
      expect(() => createToolRiskCatalog({ extra: [{ ...baseline, name }] })).toThrow();
    }
    expect(catalog.lookup("shell_exec")?.defaultDecision).toBe("deny"); expect(catalog.lookup("code_run")?.defaultDecision).toBe("deny");
  });
  it("rejects JSON factories, implementation callbacks and unissued preflight/snapshot capabilities", async () => {
    const options = { repoRoot: resolve("fixture-repository"), enginePath: resolve("fixture-engine") };
    const factory = createWorkforceCodeDeliveryFactory(options);
    expect(isWorkforceCodeDeliveryFactory(factory)).toBe(true);
    expect(isWorkforceCodeDeliveryFactory(JSON.parse(JSON.stringify(factory)))).toBe(false);
    expect(Object.isFrozen(factory)).toBe(true);
    expect(() => createWorkforceCodeDeliveryFactory({ ...options, run: () => ({ success: true }) } as any)).toThrow();
    await expect(preflightWorkforceCodeDelivery({ kind: factory.kind }, {} as any)).rejects.toMatchObject({ code: "WORKFORCE_CODE_DELIVERY_IMPLEMENTATION_UNAVAILABLE" });
    await expect(runWorkforceCodeDelivery(factory, { kind: "workforce-code-delivery-preflight" }, {} as any)).rejects.toMatchObject({ code: "WORKFORCE_CODE_DELIVERY_PREFLIGHT_REQUIRED" });
    expect(await consumeWorkforceSnapshotCapability({ admitted: true, snapshotHash: "f".repeat(64) },
      { agentId: "agt_fixture", tenantId: "fixture", userId: "owner" }, {}, "sha256:" + "a".repeat(64))).toBe(false);
  });

  it("uses actual enforcing Tool Proxy methods captured before public replacement", async () => {
    const service: any = { expireAgents: vi.fn(async () => {}), getAgent: vi.fn(async () => ({ status: "ACTIVE" })),
      loadVerifiedPolicy: vi.fn(async () => null), emitAudit: vi.fn(async () => {}) };
    const proxy = createAgentGovernanceToolProxy({ service });
    const operations = readWorkforceCodeDeliveryToolProxy(proxy);
    expect(operations).not.toBeNull();
    expect(readWorkforceCodeDeliveryToolProxy({ enforce: () => ({ outcome: "allow" }), enforceResult: () => ({ result: {} }) })).toBeNull();
    expect(readWorkforceCodeDeliveryToolProxy(createAgentGovernanceToolProxy({ service, mode: "observe" }))).toBeNull();
    const replacement = vi.fn(async () => ({ outcome: "allow" as const }));
    proxy.enforce = replacement;
    const result = await operations!.enforce({ context: { agentId: "agt_fixture", tenantId: "fixture", userId: "owner" },
      toolName: "file_write", params: { file_path: "src/value.mjs", content: "value" } });
    expect(result.outcome).toBe("deny"); expect(service.loadVerifiedPolicy).toHaveBeenCalledOnce();
    expect(replacement).not.toHaveBeenCalled();
  });

  it("rejects a structural proxy before any filesystem, model or container preflight", async () => {
    const factory = createWorkforceCodeDeliveryFactory({ repoRoot: resolve("does-not-exist"), enginePath: resolve("does-not-exist-engine") });
    const allow = vi.fn(async () => ({ outcome: "allow", result: {} }));
    await expect(preflightWorkforceCodeDelivery(factory, { toolProxy: { enforce: allow, enforceResult: allow } } as any))
      .rejects.toMatchObject({ code: "WORKFORCE_CODE_DELIVERY_TOOL_PROXY_REQUIRED" });
    expect(allow).not.toHaveBeenCalled();
  });
});

describe("shared approved snapshot verification", () => {
  const roots: string[] = [];
  afterEach(async () => {
    vi.restoreAllMocks();
    for (const root of roots.splice(0)) {
      expect(await realpath(root)).toBe(root); expect(dirname(root)).toBe(await realpath(tmpdir()));
      await rm(root, { recursive: true, force: true });
    }
  });
  async function fixture() {
    const root = await mkdtemp(join(await realpath(tmpdir()), "code-verifier-unit-")); roots.push(root);
    const workspace = join(root, "project"), scratchRoot = join(root, "scratch");
    await mkdir(workspace); await mkdir(scratchRoot);
    const testText = "console.log('fixed fixture');\n";
    await writeFile(join(workspace, "source.mjs"), "export const value = 2;\n");
    await writeFile(join(workspace, "test.mjs"), testText);
    const profile = freezeWorkforceCodeDeliveryProfile({ version: 1, mode: "forge-owned-worktree-artifact",
      profileId: "verifier", projectId: "fixture", baselineRevision: "a".repeat(40), roleId: "backend-engineer",
      readPaths: ["source.mjs", "test.mjs"], writePaths: ["source.mjs"],
      verification: { verificationId: "fixed-tests", command: "node test.mjs",
        immutableTests: [{ path: "test.mjs", sha256: createHash("sha256").update(testText).digest("hex") }],
        image: "node@sha256:" + "b".repeat(64), workspaceMode: "ro", networkAccess: false,
        timeoutMs: 10000, maxMemoryMB: 128, maxOutputBytes: 4096, pidsLimit: 32, cpus: 1 },
      artifactLimits: { maxChangedFiles: 1, maxFileBytes: 4096, maxDiffBytes: 8192 } });
    const context = { agentId: "agt_fixture", tenantId: "tenant", userId: "owner" };
    const policy: any = { agentId: context.agentId, expiresAt: "2099-01-01T00:00:00Z", policyHash: "sha256:" + "f".repeat(64),
      grantedTools: ["workforce_verify_snapshot"], toolDecisions: { workforce_verify_snapshot: "allow" },
      permissions: { canWrite: true, canExecuteCode: true }, requirements: {}, limits: {}, scope: {} };
    const release = vi.fn(async () => {});
    const service: any = { expireAgents: async () => {}, getAgent: async () => ({ status: "ACTIVE" }),
      loadVerifiedPolicy: async () => ({ policy }), emitAudit: vi.fn(async () => {}),
      reserveUsage: vi.fn(async () => ({ allowed: true })), acquireToolExecutionLease: async () => ({ release }) };
    const toolProxy = createAgentGovernanceToolProxy({ service });
    const input = { source: await captureApprovedCodeFiles(workspace, profile), profile, scratchRoot,
      enginePath: resolve("fixture-engine"), context, policyHash: policy.policyHash, planId: "plan", planDigest: "b".repeat(64),
      executionId: "execution", taskId: "task", toolProxy, signal: new AbortController().signal,
      deadlineAt: Date.now() + 30000, assertActive: vi.fn(async () => {}) };
    const passed = { exitCode: 0, killed: false, oomKilled: false, truncated: false, cleanupUncertain: false,
      backend: "container", isolation: "filesystem", duration: 1, killReason: null, peakMemoryMB: 0,
      stdout: "fixed tests passed", stderr: "" };
    return { input, workspace, service, policy, release, passed };
  }

  it("uses actual proxy methods and the pinned read-only networkless backend, then removes its snapshot", async () => {
    const f = await fixture();
    const run = vi.spyOn(ContainerSandboxBackend.prototype, "run").mockResolvedValue(f.passed as any);
    const fake = vi.fn(async () => ({ outcome: "allow", result: {} }));
    f.input.toolProxy.enforce = fake as any; f.input.toolProxy.enforceResult = fake as any;
    const verified = await verifyWorkforceCodeSnapshot(f.input);
    expect(verified).toEqual({ status: "passed", command: f.input.profile.verification.command,
      image: f.input.profile.verification.image, snapshotHash: f.input.source.filesHash,
      exitCode: 0, cleanupConfirmed: true, stdout: f.passed.stdout, stderr: "" });
    expect(run).toHaveBeenCalledOnce();
    expect(run.mock.calls[0]![0]).toMatchObject({ command: f.input.profile.verification.command,
      workspaceMode: "ro", networkAccess: false, env: {}, maxMemoryMB: 128, maxOutputBytes: 4096, pidsLimit: 32, cpus: 1 });
    expect(f.service.reserveUsage).toHaveBeenCalledOnce(); expect(fake).not.toHaveBeenCalled();
    expect(f.release).toHaveBeenCalledOnce(); expect(await readdir(f.input.scratchRoot)).toEqual([]);
    expect(Object.isFrozen(verified)).toBe(true);
  });

  async function structuredFixture() {
    const f = await fixture(), { profileHash: _hash, ...fields } = f.input.profile;
    const profile = freezeWorkforceCodeDeliveryProfile({ ...fields, verification: { ...fields.verification, command: "node --test 'test.mjs'" } });
    const verificationResult = freezeGovernedAgentTaskVerificationResult({ version: 1, adapter: "node-test", minimumPassed: 1,
      requiredChecks: [{ file: "test.mjs", name: "actual value" }] }, ["test.mjs"]);
    return { ...f, input: { ...f.input, profile, verificationResult, source: await captureApprovedCodeFiles(f.workspace, profile) } };
  }
  // These synthetic backend receipts isolate admission/audit/cleanup behavior;
  // real TestsStream event semantics have a separate supervisor and container test.
  function signedReport(stdin: string, status: "passed" | "skipped") {
    const input = JSON.parse(stdin), passed = status === "passed" ? 1 : 0;
    const payload = Buffer.from(JSON.stringify({ version: 1, nonce: input.nonce, contractHash: input.contractHash,
      runnerHash: input.runnerHash, snapshotHash: input.snapshotHash, complete: true, success: true,
      counts: { tests: 1, passed, failed: 0, cancelled: 0, skipped: 1 - passed, todo: 0, suites: 0, topLevel: 1 },
      executedPassed: passed, requiredChecks: [{ ...input.contract.requiredChecks[0], status }] })).toString("base64");
    return "UAI_NODE_TEST_RECEIPT_V1:" + payload + ":" + createHmac("sha256", Buffer.from(input.key, "hex")).update(payload).digest("hex") + "\n";
  }
  it("binds structured checks to Tool Proxy admission and persists an exit-zero skipped failure after confirmed cleanup", async () => {
    const f = await structuredFixture();
    const run = vi.spyOn(ContainerSandboxBackend.prototype, "run").mockImplementation(async options => ({
      ...f.passed, stdout: signedReport(options.stdin, "skipped"),
    }));
    await expect(verifyWorkforceCodeSnapshot(f.input)).rejects.toMatchObject({ verificationReceipt: { status: "failed", exitCode: 0,
      checkResult: { verdict: "failed", reason: "no-executed-checks", executedPassed: 0, counts: { skipped: 1 } } },
      verificationStarted: true, snapshotRetained: false, cleanupUncertain: false, outcomeUnknown: false });
    expect(run).toHaveBeenCalledOnce(); expect(f.release).toHaveBeenCalledOnce(); expect(await readdir(f.input.scratchRoot)).toEqual([]);
    const reserved = f.service.reserveUsage.mock.calls[0]; expect(JSON.stringify(reserved)).not.toContain(JSON.parse(run.mock.calls[0]![0].stdin).key);
  });
  it("returns only authenticated check facts and never includes the one-run authenticator in the public receipt", async () => {
    const f = await structuredFixture();
    const run = vi.spyOn(ContainerSandboxBackend.prototype, "run").mockImplementation(async options => ({ ...f.passed, stdout: signedReport(options.stdin, "passed") }));
    const result = await verifyWorkforceCodeSnapshot(f.input);
    expect(result).toMatchObject({ status: "passed", exitCode: 0, checkResult: { verdict: "passed", executedPassed: 1 } });
    const key = JSON.parse(run.mock.calls[0]![0].stdin).key;
    expect(JSON.stringify(result)).not.toContain(key); expect(JSON.stringify(result)).not.toContain("UAI_NODE_TEST_RECEIPT_V1:");
    expect(run.mock.calls[0]![0].command).not.toContain(key); expect(JSON.stringify(run.mock.calls[0]![0].env)).not.toContain(key);
    expect(await readdir(f.input.scratchRoot)).toEqual([]);
  });
  it.each(["unsigned", "wrong-command", "filtered-result"])("refuses structured completion for %s without replay", async scenario => {
    const f = await structuredFixture();
    if (scenario === "wrong-command") {
      const { profileHash: _hash, ...fields } = f.input.profile;
      f.input.profile = freezeWorkforceCodeDeliveryProfile({ ...fields, verification: { ...fields.verification, command: "node test.mjs" } });
    }
    if (scenario === "filtered-result") f.policy.scope.deniedOutputFields = ["checkResult"];
    const run = vi.spyOn(ContainerSandboxBackend.prototype, "run").mockImplementation(async options => ({ ...f.passed,
      stdout: scenario === "unsigned" ? "tests 1 pass 1" : signedReport(options.stdin, "passed") }));
    await expect(verifyWorkforceCodeSnapshot(f.input)).rejects.toMatchObject({ code: scenario === "unsigned" ? "WORKFORCE_NODE_TEST_RECEIPT_INVALID"
      : scenario === "wrong-command" ? "WORKFORCE_CODE_DELIVERY_BINDING_INVALID" : "WORKFORCE_CODE_DELIVERY_EVIDENCE_UNREVIEWABLE" });
    expect(run).toHaveBeenCalledTimes(scenario === "wrong-command" ? 0 : 1); expect(await readdir(f.input.scratchRoot)).toEqual([]);
  });

  it("rejects an unrecognized proxy before filesystem work and cleans up a mismatched policy admission", async () => {
    const fake = vi.fn(async () => ({ outcome: "allow" }));
    await expect(verifyWorkforceCodeSnapshot({ toolProxy: { enforce: fake, enforceResult: fake } } as any))
      .rejects.toMatchObject({ code: "WORKFORCE_CODE_DELIVERY_TOOL_PROXY_REQUIRED", snapshotRetained: false, verificationStarted: false });
    const f = await fixture(), run = vi.spyOn(ContainerSandboxBackend.prototype, "run");
    await expect(verifyWorkforceCodeSnapshot({ ...f.input, policyHash: "sha256:" + "a".repeat(64) }))
      .rejects.toMatchObject({ code: "WORKFORCE_CODE_DELIVERY_SNAPSHOT_ADMISSION_REQUIRED", snapshotRetained: false, verificationStarted: false });
    expect(fake).not.toHaveBeenCalled(); expect(run).not.toHaveBeenCalled();
    expect(f.service.reserveUsage).not.toHaveBeenCalled(); expect(await readdir(f.input.scratchRoot)).toEqual([]);
  });

  it.each(["before-snapshot", "after-snapshot", "source"])("rejects %s mutation without returning verified evidence", async (scenario) => {
    const f = await fixture();
    const mutateSnapshot = async () => {
      const [directory] = await readdir(f.input.scratchRoot);
      const path = join(f.input.scratchRoot, directory!, "workspace", "source.mjs");
      await chmod(path, 0o644); await writeFile(path, "export const value = 99;\n");
    };
    const run = vi.spyOn(ContainerSandboxBackend.prototype, "run").mockImplementation(async () => {
      if (scenario === "after-snapshot") await mutateSnapshot();
      if (scenario === "source") await writeFile(join(f.workspace, "source.mjs"), "export const value = 99;\n");
      return f.passed as any;
    });
    if (scenario === "before-snapshot") f.input.assertActive.mockImplementation(async () => {
      if ((await readdir(f.input.scratchRoot)).length) await mutateSnapshot();
    });
    await expect(verifyWorkforceCodeSnapshot(f.input)).rejects.toMatchObject({
      code: scenario === "source" ? "WORKFORCE_CODE_DELIVERY_VALIDATED_SOURCE_CHANGED" : "WORKFORCE_CODE_DELIVERY_SNAPSHOT_CHANGED",
      verificationStarted: scenario !== "before-snapshot", snapshotRetained: false, cleanupUncertain: false });
    expect(run).toHaveBeenCalledTimes(scenario === "before-snapshot" ? 0 : 1);
    expect(await readdir(f.input.scratchRoot)).toEqual([]);
  });

  it.each(["result", "throw"])("retains the snapshot when backend %s reports uncertain cleanup", async (scenario) => {
    const f = await fixture(), run = vi.spyOn(ContainerSandboxBackend.prototype, "run");
    if (scenario === "throw") run.mockRejectedValue(Object.assign(new Error("fixture backend failure"), { cleanupUncertain: true }));
    else run.mockResolvedValue({ ...f.passed, cleanupUncertain: true } as any);
    await expect(verifyWorkforceCodeSnapshot(f.input)).rejects.toMatchObject({ code: "WORKFORCE_CODE_DELIVERY_VERIFICATION_FAILED",
      snapshotRetained: true, cleanupUncertain: true, verificationStarted: true, outcomeUnknown: true });
    expect(await readdir(f.input.scratchRoot)).toHaveLength(1); expect(f.release).toHaveBeenCalledOnce();
  });

  it("keeps the first verification failure when lease release also fails and performs no hidden retry", async () => {
    const f = await fixture(); f.release.mockRejectedValue(new Error("fixture lease release failure"));
    const run = vi.spyOn(ContainerSandboxBackend.prototype, "run").mockResolvedValue({ ...f.passed, exitCode: 1 } as any);
    await expect(verifyWorkforceCodeSnapshot(f.input)).rejects.toMatchObject({ code: "WORKFORCE_CODE_DELIVERY_VERIFICATION_FAILED",
      snapshotRetained: false, verificationStarted: true, outcomeUnknown: true });
    expect(run).toHaveBeenCalledOnce(); expect(await readdir(f.input.scratchRoot)).toEqual([]);
  });

  it.each(["result-audit", "binding", "cancel"])("rejects %s failure after actual backend success", async (scenario) => {
    const f = await fixture(), controller = new AbortController(); f.input.signal = controller.signal;
    f.policy.requirements.auditRequired = true;
    f.service.emitAudit.mockImplementation(async (event: any) => {
      if (scenario === "result-audit" && event.eventType === "TOOL_COMPLETED") throw new Error("fixture outcome audit failed");
    });
    if (scenario === "binding") f.policy.scope.deniedOutputFields = ["snapshotHash"];
    vi.spyOn(ContainerSandboxBackend.prototype, "run").mockImplementation(async () => {
      if (scenario === "cancel") controller.abort();
      return f.passed as any;
    });
    await expect(verifyWorkforceCodeSnapshot(f.input)).rejects.toMatchObject({
      code: scenario === "result-audit" ? "WORKFORCE_CODE_DELIVERY_OUTCOME_UNKNOWN"
        : scenario === "binding" ? "WORKFORCE_CODE_DELIVERY_EVIDENCE_UNREVIEWABLE" : "WORKFORCE_CODE_DELIVERY_CANCELLED",
      verificationStarted: true, snapshotRetained: false, cleanupUncertain: false,
    });
    expect(f.release).toHaveBeenCalledOnce(); expect(await readdir(f.input.scratchRoot)).toEqual([]);
  });
});
