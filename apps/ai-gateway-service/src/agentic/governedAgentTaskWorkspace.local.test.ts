// @test-scope local
// @test-isolation process
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, it } from "vitest";
import { createAgentGovernanceToolProxy } from "../agent-governance/toolProxy.ts";
import { createWorkforceGit } from "../workforce/workforceGit.ts";
import { freezeGovernedAgentTaskProfile, parseGovernedAgentTaskPlan } from "./governedAgentTaskProfile.ts";
import { createGovernedAgentTaskWorkspace } from "./governedAgentTaskWorkspace.ts";

const enabled = process.env.AI_GATEWAY_CODE_DELIVERY_CONTAINER_TEST === "1";
const enginePath = process.env.AI_GATEWAY_CODE_DELIVERY_TEST_ENGINE ?? "";
const image = process.env.AI_GATEWAY_CODE_DELIVERY_TEST_IMAGE ?? "";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

it.skipIf(!enabled)("uses actual owned-worktree tools and real immutable read-only networkless verification through failed then repaired source", async () => {
  const parent = await realpath(tmpdir()), root = await mkdtemp(join(parent, "agent-task-real-workspace-"));
  let cleanupSafe = true;
  try {
    const repoRoot = join(root, "repo"), worktreeRoot = join(root, "worktrees"), scratchRoot = join(root, "scratch");
    await mkdir(repoRoot); await mkdir(scratchRoot);
    const testText = "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { writeFileSync, existsSync } from 'node:fs';\nimport { networkInterfaces } from 'node:os';\nimport { value } from './source.mjs';\ntest('read-only exact networkless snapshot and actual value', () => { assert.equal(existsSync('/workspace/unapproved.txt'), false); assert.throws(() => writeFileSync('/workspace/source.mjs', 'unexpected')); assert.deepEqual(Object.keys(networkInterfaces()).filter(name => name !== 'lo'), []); assert.equal(value, 2); });\n";
    await writeFile(join(repoRoot, "source.mjs"), "export const value = 1;\n");
    await writeFile(join(repoRoot, "test.mjs"), testText); await writeFile(join(repoRoot, "unapproved.txt"), "not mounted");
    const git = createWorkforceGit(repoRoot);
    await git.run(["-c", "init.templateDir=", "init", "--initial-branch=main"]);
    await git.run(["add", "source.mjs", "test.mjs", "unapproved.txt"]);
    await git.run(["-c", "user.name=Agent Real Workspace Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgSign=false", "commit", "-m", "Immutable real-container fixture"]);
    const baselineRevision = (await git.run(["rev-parse", "HEAD"])).stdout.trim();
    const profile = freezeGovernedAgentTaskProfile({ version: 1, mode: "governed-agent-long-task", profileId: "real-workspace", projectId: "fixture", baselineRevision,
      model: { providerId: "fake", modelId: "fake", maxInputTokens: 8192, maxOutputTokens: 4096 },
      limits: { maxPlanSteps: 3, maxIterations: 6, maxModelCalls: 7, maxTotalTokens: 32768, maxRepairAttempts: 2, chunkTimeoutMs: 120000, maxInputBytes: 4096 },
      verificationResult: { version: 1, adapter: "node-test", minimumPassed: 1,
        requiredChecks: [{ file: "test.mjs", name: "read-only exact networkless snapshot and actual value" }] },
      artifact: { readPaths: ["source.mjs", "test.mjs"], writePaths: ["source.mjs"],
        verification: { verificationId: "fixed-test", command: "node --test 'test.mjs'", immutableTests: [{ path: "test.mjs", sha256: hash(testText) }],
          image, workspaceMode: "ro", networkAccess: false, timeoutMs: 15000, maxMemoryMB: 128, maxOutputBytes: 65536, pidsLimit: 32, cpus: 1 },
        artifactLimits: { maxChangedFiles: 1, maxFileBytes: 4096, maxDiffBytes: 8192 } } });
    const factory = createGovernedAgentTaskWorkspace({ repoRoot, worktreeRoot, scratchRoot, enginePath, profile });
    const prepared = await factory.prepareReview({ goal: "Set value to two", prompt: "Inspect, implement, verify and repair the approved source." });
    const plan = parseGovernedAgentTaskPlan(JSON.stringify({ version: 1, reviewHash: prepared.review.reviewHash, steps: [
      { id: "inspect", kind: "inspect", title: "Read actual source", paths: ["source.mjs"] },
      { id: "implement", kind: "implement", title: "Change source", paths: ["source.mjs"] },
      { id: "verify", kind: "verify", title: "Independent fixed tests", paths: ["test.mjs"] },
    ] }), prepared.review);
    const context = { agentId: "agt_real_workspace", tenantId: "fixture", userId: "owner" };
    const tools = ["file_read", "file_write", "file_edit", "workforce_verify_snapshot"];
    const policy: any = { agentId: context.agentId, expiresAt: "2099-01-01T00:00:00Z", policyHash: "sha256:" + "f".repeat(64),
      grantedTools: tools, toolDecisions: Object.fromEntries(tools.map(tool => [tool, "allow"])),
      permissions: { canWrite: true, canExecuteCode: true }, requirements: {}, limits: {}, scope: {} };
    // Genuine Tool Proxy with a fixture policy service proves local governance execution, not HTTP approval admission.
    const service: any = { expireAgents: async () => {}, getAgent: async () => ({ status: "ACTIVE" }), loadVerifiedPolicy: async () => ({ policy }),
      reserveUsage: async () => ({ allowed: true }), emitAudit: async () => {}, acquireToolExecutionLease: async () => ({ release: async () => {} }) };
    let index = 0, repair = 0;
    const chunk = await factory.forChunk({ taskId: "real-task", review: prepared.review, plan, context, policyHash: policy.policyHash,
      toolProxy: createAgentGovernanceToolProxy({ service }), signal: new AbortController().signal, deadlineAt: Date.now() + 120000,
      assertActive: async () => {}, getStep: () => plan.steps[index]!, getRepairAttempt: () => repair });
    await chunk.tools.executeTool("file_read", { file_path: "source.mjs" }); expect(chunk.stepReceipts()[0]?.fullRead).toBe(true);
    index = 1; await chunk.tools.executeTool("file_write", { file_path: "source.mjs", content: "export const value = 0;\n" }); index = 2;
    let first;
    try { first = await chunk.verify(); } catch (error) { cleanupSafe = (error as { outcomeUnknown?: boolean }).outcomeUnknown !== true; throw error; }
    expect(first.status).toBe("failed"); expect(first.verification.exitCode).toBeGreaterThan(0);
    expect(first.verification.checkResult).toMatchObject({ verdict: "failed", executedPassed: 0,
      requiredChecks: [{ file: "test.mjs", name: "read-only exact networkless snapshot and actual value", status: "failed" }] });
    expect(first.verification.stdout).toContain("[node-test test:fail]");
    repair = 1; index = 1; await chunk.tools.executeTool("file_edit", { file_path: "source.mjs", old_string: "0", new_string: "2" }); index = 2;
    let corrected;
    try { corrected = await chunk.verify(); } catch (error) { cleanupSafe = (error as { outcomeUnknown?: boolean }).outcomeUnknown !== true; throw error; }
    expect(corrected.status).toBe("passed"); expect(corrected.verification.stdout).toContain("[node-test test:pass]");
    expect(corrected.verification.checkResult).toMatchObject({ verdict: "passed", executedPassed: 1,
      counts: { tests: 1, passed: 1, failed: 0, cancelled: 0, skipped: 0, todo: 0 },
      requiredChecks: [{ file: "test.mjs", name: "read-only exact networkless snapshot and actual value", status: "passed" }] });
    expect(corrected.failures).toEqual([first.verification]); expect(corrected.artifact.filesChanged.map(file => file.path)).toEqual(["source.mjs"]);
    expect(await readFile(join(repoRoot, "source.mjs"), "utf8")).toBe("export const value = 1;\n");
    expect(await readFile(join(chunk.workingDirectory, "test.mjs"), "utf8")).toBe(testText);
    expect(await readdir(chunk.workingDirectory)).not.toContain("source.mjs.bak"); expect(await readdir(scratchRoot)).toEqual([]);
    expect((await git.run(["status", "--porcelain"])).stdout).toBe("");
    await chunk.close(); expect(factory.hasOwnership("real-task", chunk.workspaceReceipt)).toBe(true);
  } finally {
    if (cleanupSafe) {
      expect(await realpath(root)).toBe(root); expect(dirname(root)).toBe(parent); await rm(root, { recursive: true, force: true });
    }
  }
}, 150000);
