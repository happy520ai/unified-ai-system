import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
vi.mock("./fiveCapabilityActivationSupport.js", async importOriginal => ({
  ...await importOriginal<typeof import("./fiveCapabilityActivationSupport.js")>(),
  inspectCli: vi.fn(async () => ({ available: true, version: "owned-fixture-only" })),
}));
import { createFiveCapabilityActivationService } from "./fiveCapabilityActivationService.js";

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) {
  const relative = resolve(root).slice(resolve(tmpdir()).length + 1);
  if (!resolve(root).startsWith(resolve(tmpdir()) + sep) || !relative.startsWith("taiji-summary-test-") || relative.includes(sep)) throw new Error("Unowned cleanup path");
  await rm(root, { recursive: true, force: true });
} });

it("the five-capability summary cannot count a dry-run or CLI presence as five actual executions", async () => {
  const root = await mkdtemp(join(tmpdir(), "taiji-summary-test-")); roots.push(root);
  const workforceService = { runLocal: async () => ({ executionStatus: "completed", previewOnly: false, planId: "fixture-plan", runId: "fixture-run" }) };
  const service = createFiveCapabilityActivationService({ repoRoot: root, workforceService, application: undefined, taijiCapabilityService: undefined });
  const result = await service.activateFive();
  expect(result.completionVerified).toBe(false); expect(result.realCapabilityActivationReady).toBe(false);
  expect(result.capabilities.taijiBeidou.realLocalExecution).toBe(false);
  expect(result.capabilities.taijiBeidou.priorExecutionVerified).toBe(false);
  expect(result.capabilities.gvc.verifierPassed).toBe(true);
  expect(await readFile(join(root, result.capabilities.gvc.evidencePath), "utf8")).toContain("realWritePerformed: true");
});

it("a verified prior Taiji receipt is reported as prior evidence without performing a new execution", async () => {
  const root = await mkdtemp(join(tmpdir(), "taiji-summary-test-")); roots.push(root);
  const status = vi.fn(async () => ({ enabled: true,
    profiles: [{ id: "context-jsonl-v1", implementationHash: "same-implementation" }],
    capabilities: [{ id: "facts", activation: { epoch: 2, expiresAt: Date.now() + 30_000 },
      versions: [{ revision: 1, profileId: "context-jsonl-v1", implementationHash: "same-implementation", status: "evaluated" }] }],
    runs: [{ id: "prior-run", capabilityId: "facts", revision: 1, activationEpoch: 2, status: "passed",
      result: { actualExecution: true, workerClosed: true, artifact: { sha256: "prior-artifact" } } }] }));
  const execute = vi.fn();
  const service = createFiveCapabilityActivationService({ repoRoot: root, application: undefined,
    workforceService: { runLocal: async () => ({ executionStatus: "completed", previewOnly: false }) }, taijiCapabilityService: { status, execute } });
  const result = await service.activateFive({ agentId: "agt_fixture" }, { identity: { tenantId: "tenant-a", userId: "owner" } });
  expect(result.capabilities.taijiBeidou).toMatchObject({ priorExecutionVerified: true, newExecutionPerformed: false, realLocalExecution: false });
  expect(result.completionVerified).toBe(false); expect(result.realCapabilityActivationReady).toBe(false); expect(execute).not.toHaveBeenCalled();
});
