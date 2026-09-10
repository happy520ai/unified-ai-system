import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createTaijiCapabilityService, taijiDigest } from "./taijiCapabilityService.ts";
import type { TaijiExecutionAuthority } from "./taijiCapabilityService.ts";
import type { TaijiOperation } from "./taijiCapabilityService.ts";
import type { TaijiRun } from "./taijiCapabilityState.ts";

const roots: string[] = [];
const services: ReturnType<typeof createTaijiCapabilityService>[] = [];
const owner = { tenantId: "tenant-a", userId: "operator-a", agentId: "agt_capability" };
const authority = (): TaijiExecutionAuthority => ({ policyHash: taijiDigest("test-policy"), approvalId: "approval-fixture",
  signal: new AbortController().signal, assertActive: async () => {} });
async function setup() {
  const root = await mkdtemp(join(tmpdir(), "taiji-runtime-test-")); roots.push(root);
  const options = { dataDir: root, secret: "synthetic-taiji-governance-secret-for-owned-tests", enabled: () => true };
  const service = createTaijiCapabilityService(options); services.push(service);
  return { root, options, service };
}
async function evaluated(service: ReturnType<typeof createTaijiCapabilityService>) {
  const prepared = await service.prepare("evaluate", { capabilityId: "facts", expectedLifecycleRevision: 0,
    request: "Encode supplied context facts while preserving their values and references", profileId: "context-jsonl-v1" }, owner);
  const result = await service.execute(prepared, authority());
  expect(result.status).toBe("evaluated");
  const snapshot = await service.status(owner); const capability = snapshot.capabilities[0];
  expect(capability.versions[0].evaluation?.tests).toHaveLength(3);
  expect(capability.activation).toBeNull();
  return capability;
}
async function activated(service: ReturnType<typeof createTaijiCapabilityService>, maxRequests = 3) {
  const capability = await evaluated(service);
  const prepared = await service.prepare("activate", { capabilityId: "facts", expectedLifecycleRevision: capability.lifecycleRevision,
    revision: 1, limits: { ttlSeconds: 300, maxRequests, maxRuntimeMs: 30_000 } }, owner);
  const result = await service.execute(prepared, authority()); expect(result.status).toBe("active");
  return (await service.status(owner)).capabilities[0];
}
const inputFor = (lifecycleRevision: number, runId = "run-one") => ({ capabilityId: "facts", expectedLifecycleRevision: lifecycleRevision,
  revision: 1, runId, arguments: { facts: [{ key: "amount", value: 7, reference: "invoice:1" }, { key: "approved", value: false }] } });
afterEach(async () => {
  for (const service of services.splice(0)) await service.close();
  for (const root of roots.splice(0)) {
    const base = resolve(tmpdir()); const target = resolve(root);
    if (!target.startsWith(base + sep) || !target.slice(base.length + 1).startsWith("taiji-runtime-test-") || target.slice(base.length + 1).includes(sep)) throw new Error("Refusing unowned test cleanup");
    await rm(target, { recursive: true, force: true });
  }
});

describe("Taiji actual capability lifecycle", () => {
  it("evaluates, activates, executes and reads persisted artifacts for the exact owner", async () => {
    const { service } = await setup(), capability = await activated(service);
    const prepared = await service.prepare("execute", inputFor(capability.lifecycleRevision), owner);
    const result = await service.execute(prepared, authority());
    expect(result.status).toBe("passed");
    const status = await service.status(owner);
    expect(status.runs[0].result?.actualExecution).toBe(true);
    expect(status.runs[0].result?.workerClosed).toBe(true);
    const artifact = status.runs[0].result?.artifact as { content: string; sha256: string };
    expect(artifact.content.split("\n").map(line => JSON.parse(line))).toEqual(inputFor(capability.lifecycleRevision).arguments.facts);
    expect(status.capabilities[0].totalRequests).toBe(1);
    expect(status.capabilities[0].activation?.requests).toBe(1);
    expect(status.capabilities[0].totalElapsedMs).toBeGreaterThan(0);
    expect((await service.status({ ...owner, tenantId: "tenant-b" })).runs).toEqual([]);
    expect((await service.status({ ...owner, userId: "operator-b" })).capabilities).toEqual([]);
    const replay = await service.prepare("execute", inputFor(capability.lifecycleRevision), owner);
    expect(replay.replay?.status).toBe("passed");
    await expect(service.execute(replay, authority())).rejects.toMatchObject({ code: "TAIJI_EXECUTION_AUTHORITY_REQUIRED" });
    expect((await service.status(owner)).capabilities[0].totalRequests).toBe(1);
  });

  it("preparation is not authority, and changed reviewed arguments cannot execute", async () => {
    const { service } = await setup(), capability = await activated(service);
    const prepared = await service.prepare("execute", inputFor(capability.lifecycleRevision), owner);
    (prepared.params.arguments as { facts: { value: number }[] }).facts[0].value = 1000;
    await expect(service.execute(prepared, authority())).rejects.toMatchObject({ code: "TAIJI_EXECUTION_AUTHORITY_REQUIRED" });
    const fake = { params: structuredClone(prepared.params), review: prepared.review };
    await expect(service.execute(fake, authority())).rejects.toMatchObject({ code: "TAIJI_EXECUTION_AUTHORITY_REQUIRED" });
    expect((await service.status(owner)).runs).toHaveLength(0);
  });

  it("revocation fences pending execution and the revoked version never reactivates", async () => {
    const { service } = await setup(), capability = await activated(service);
    const prepared = await service.prepare("execute", inputFor(capability.lifecycleRevision), owner);
    const stopped = await service.revoke({ capabilityId: "facts", expectedLifecycleRevision: capability.lifecycleRevision, revision: 1 }, owner, async () => {});
    expect(stopped.status).toBe("revoked");
    await expect(service.execute(prepared, authority())).rejects.toMatchObject({ code: "TAIJI_REVISION_CONFLICT" });
    await expect(service.prepare("activate", { capabilityId: "facts", expectedLifecycleRevision: stopped.capability.lifecycleRevision, revision: 1 }, owner)).rejects.toMatchObject({ code: "TAIJI_CANDIDATE_NOT_VERIFIED" });
    expect((await service.status(owner)).runs).toHaveLength(0);
  });

  it("a post-worker revocation cannot become a late successful completion", async () => {
    const { service } = await setup(), capability = await activated(service);
    let release!: () => void, reached!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const observed = new Promise<void>(resolve => { reached = resolve; });
    let calls = 0;
    const guard = authority(); guard.assertActive = async () => { if (++calls === 3) { reached(); await held; } };
    const prepared = await service.prepare("execute", inputFor(capability.lifecycleRevision), owner);
    const running = service.execute(prepared, guard);
    try {
      await observed;
      await service.revoke({ capabilityId: "facts", expectedLifecycleRevision: capability.lifecycleRevision, revision: 1 }, owner, async () => {});
    } finally { release(); }
    const result = await running;
    expect(result.status).toBe("cancelled");
    const status = await service.status(owner);
    expect(status.runs[0].result?.artifact).toBeNull(); expect(status.runs[0].result?.workerClosed).toBe(true);
  });

  it("cumulative activation budget is reserved before work and is not reset by replay", async () => {
    const { service } = await setup(), capability = await activated(service, 1);
    const prepared = await service.prepare("execute", inputFor(capability.lifecycleRevision), owner);
    await service.execute(prepared, authority());
    const extra = await service.prepare("execute", inputFor(capability.lifecycleRevision, "run-two"), owner);
    await expect(service.execute(extra, authority())).rejects.toMatchObject({ code: "TAIJI_BUDGET_EXHAUSTED" });
    expect((await service.status(owner)).runs).toHaveLength(1);
  });

  it("restart preserves history and results, suspends activation and rejects an old signed state file", async () => {
    const { root, options, service } = await setup(), capability = await activated(service);
    const old = await readFile(join(root, "taiji-capabilities.json"));
    await service.execute(await service.prepare("execute", inputFor(capability.lifecycleRevision), owner), authority());
    await service.close();
    const restarted = createTaijiCapabilityService(options); services.push(restarted);
    const current = await restarted.status(owner);
    expect(current.capabilities[0].activation).toBeNull(); expect(current.capabilities[0].totalRequests).toBe(1);
    expect(current.capabilities[0].history.at(-1)?.operation).toBe("restart-suspend");
    expect(current.runs[0].status).toBe("passed");
    await expect(restarted.prepare("execute", inputFor(current.capabilities[0].lifecycleRevision, "after-restart"), owner)).rejects.toMatchObject({ code: "TAIJI_ACTIVATION_REQUIRED" });
    const latest = await readFile(join(root, "taiji-capabilities.json"));
    await writeFile(join(root, "taiji-capabilities.json"), old);
    await expect(restarted.status(owner)).rejects.toThrow();
    await writeFile(join(root, "taiji-capabilities.json"), latest);
  });

  it("a repeated close by an old runtime cannot release the new owner's state", async () => {
    const { service, options } = await setup(); await evaluated(service); await service.close();
    const restarted = createTaijiCapabilityService(options); services.push(restarted); await restarted.status(owner);
    await service.close();
    const competing = createTaijiCapabilityService(options); services.push(competing);
    await expect(competing.status(owner)).rejects.toMatchObject({ code: "TAIJI_OWNER_ACTIVE" });
    expect((await restarted.status(owner)).capabilities).toHaveLength(1);
  });

  it("admits exactly one concurrent initial state owner", async () => {
    const { service, options } = await setup(); const other = createTaijiCapabilityService(options); services.push(other);
    const results = await Promise.allSettled([service.status(owner), other.status(owner)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const refused = results.find(result => result.status === "rejected") as PromiseRejectedResult;
    expect(refused.reason).toMatchObject({ code: "TAIJI_OWNER_ACTIVE" });
    const winner = results[0].status === "fulfilled" ? service : other;
    expect((await winner.status(owner)).capabilities).toEqual([]);
    if (process.platform === "win32") {
      const alias = createTaijiCapabilityService({ ...options, dataDir: options.dataDir.toUpperCase() }); services.push(alias);
      await expect(alias.status(owner)).rejects.toMatchObject({ code: "TAIJI_OWNER_ACTIVE" });
      expect((await winner.status(owner)).capabilities).toEqual([]);
    }
  });

  it("uses real feedback for selection, rejects stale selection, and repairs the unchanged failed goal before activation", async () => {
    const { service } = await setup();
    const cap = async (id: string) => (await service.status(owner)).capabilities.find(item => item.id === id)!;
    const perform = async (operation: TaijiOperation, body: Record<string, unknown>) => service.execute(await service.prepare(operation, body, owner), authority());
    const change = async (operation: TaijiOperation, id: string, body: Record<string, unknown> = {}) => perform(operation,
      { capabilityId: id, expectedLifecycleRevision: (await cap(id)).lifecycleRevision, revision: 1, ...body });
    for (const id of ["a", "b"]) {
      expect((await perform("evaluate", { capabilityId: id, expectedLifecycleRevision: 0,
        request: "Risk classification for release wording", profileId: "risk-classification-v1" })).status).toBe("evaluated");
      expect((await change("activate", id)).status).toBe("active");
    }
    const benign = { text: "summarize a paragraph", expectedSignals: [] };
    await change("execute", "b", { runId: "b-pass", arguments: benign });
    expect((await change("reweight", "b", { sourceRunId: "b-pass" })).status).toBe("reweighted");
    expect((await cap("b")).versions[0].weight).toBe(0.6);
    await expect(change("reweight", "b", { sourceRunId: "b-pass" })).rejects.toMatchObject({ code: "TAIJI_FEEDBACK_ALREADY_USED" });
    const selected = await perform("execute", { selection: { profileId: "risk-classification-v1" }, runId: "selected-b", arguments: benign }) as { run: TaijiRun };
    expect(selected.run.capabilityId).toBe("b"); expect(selected.run.status).toBe("passed");
    const stale = await service.prepare("execute", { selection: { profileId: "risk-classification-v1" }, runId: "stale-selection", arguments: benign }, owner);
    await change("execute", "a", { runId: "a-pass", arguments: benign });
    await change("reweight", "a", { sourceRunId: "a-pass" });
    await expect(service.execute(stale, authority())).rejects.toMatchObject({ code: "TAIJI_SELECTION_CHANGED" });
    const reselected = await perform("execute", { selection: { profileId: "risk-classification-v1" }, runId: "selected-a", arguments: benign }) as { run: TaijiRun };
    expect(reselected.run.capabilityId).toBe("a"); expect(reselected.run.status).toBe("passed");
    const originalFailure = { text: "ship production", expectedSignals: ["deploy_release"] };
    expect((await change("execute", "a", { runId: "a-fail-one", arguments: originalFailure })).status).toBe("failed");
    await change("reweight", "a", { sourceRunId: "a-fail-one" });
    expect((await cap("a")).versions[0].weight).toBe(0.35);
    await change("activate", "a");
    expect((await change("execute", "a", { runId: "a-fail-two", arguments: originalFailure })).status).toBe("failed");
    await change("reweight", "a", { sourceRunId: "a-fail-two" });
    expect((await cap("a")).versions[0].weight).toBe(0.1);
    expect((await change("prune", "a", { sourceRunId: "a-fail-two" })).status).toBe("pruned");
    expect((await cap("a")).versions[0].status).toBe("revoked"); expect((await cap("a")).activation).toBeNull();
    await expect(change("activate", "a")).rejects.toMatchObject({ code: "TAIJI_CANDIDATE_NOT_VERIFIED" });
    await expect(change("repair", "a", { sourceRunId: "a-fail-two", sourceArguments: { ...originalFailure, expectedSignals: [] },
      addRiskKeywords: { deploy_release: ["ship production"] } })).rejects.toMatchObject({ code: "TAIJI_REGRESSION_CHANGED" });
    const repaired = await change("repair", "a", { sourceRunId: "a-fail-two", sourceArguments: originalFailure,
      addRiskKeywords: { deploy_release: ["ship production"] } });
    expect(repaired.status).toBe("evaluated");
    const version = (await cap("a")).versions[1];
    expect(version.regression?.arguments).toEqual(originalFailure);
    expect(version.evaluation?.tests.find(test => test.id === "recorded-failure:a-fail-two")?.status).toBe("passed");
    expect(version.evaluation?.tests).toHaveLength(11);
    await change("activate", "a", { revision: 2 });
    const fixed = await change("execute", "a", { revision: 2, runId: "a-repaired", arguments: originalFailure }) as { run: TaijiRun };
    expect(fixed.run.status).toBe("passed");
    expect(JSON.parse((fixed.run.result!.artifact as { content: string }).content).signals).toEqual(["deploy_release"]);
    const history = (await service.status(owner)).runs;
    expect(history.find(run => run.id === "a-fail-two")?.status).toBe("failed");
    expect(history.find(run => run.id === "a-fail-two")?.argumentsHash).toBe(fixed.run.argumentsHash);
    expect((await cap("a")).versions[0].status).toBe("revoked");
  }, 30_000);

  it("does not treat a cancelled real worker as negative quality feedback", async () => {
    const { service } = await setup(), capability = await activated(service);
    const controller = new AbortController(); let release!: () => void, reached!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; }), observed = new Promise<void>(resolve => { reached = resolve; });
    let checks = 0;
    const prepared = await service.prepare("execute", inputFor(capability.lifecycleRevision, "cancel-quality"), owner);
    const running = service.execute(prepared, { ...authority(), signal: controller.signal, assertActive: async () => { if (++checks === 3) { reached(); await held; } } });
    try { await observed; controller.abort(); } finally { release(); }
    expect((await running).status).toBe("cancelled");
    const run = (await service.status(owner)).runs[0]; expect(run.result?.actualExecution).toBe(true); expect(run.result?.workerClosed).toBe(true);
    await expect(service.prepare("reweight", { capabilityId: "facts", expectedLifecycleRevision: capability.lifecycleRevision, revision: 1, sourceRunId: run.id }, owner))
      .rejects.toMatchObject({ code: "TAIJI_FEEDBACK_UNVERIFIED" });
    expect((await service.status(owner)).capabilities[0].versions[0].weight).toBe(0.5);
  });

  it("limits repairs of one failure to three distinct candidates and rejects unrelated keywords", async () => {
    const { service } = await setup();
    const current = async () => (await service.status(owner)).capabilities[0];
    const perform = async (operation: TaijiOperation, body: Record<string, unknown>) => service.execute(await service.prepare(operation, body, owner), authority());
    await perform("evaluate", { capabilityId: "risk", expectedLifecycleRevision: 0, profileId: "risk-classification-v1", request: "Risk classification for production shipping" });
    await perform("activate", { capabilityId: "risk", expectedLifecycleRevision: 1, revision: 1 });
    const args = { text: "ship production and launch production", expectedSignals: ["deploy_release"] };
    expect((await perform("execute", { capabilityId: "risk", expectedLifecycleRevision: 2, revision: 1, runId: "source-failure", arguments: args })).status).toBe("failed");
    const repairBody = async (keyword: string) => ({ capabilityId: "risk", expectedLifecycleRevision: (await current()).lifecycleRevision,
      revision: 1, sourceRunId: "source-failure", sourceArguments: args, addRiskKeywords: { deploy_release: [keyword] } });
    await expect(service.prepare("repair", await repairBody("unrelated language"), owner)).rejects.toMatchObject({ code: "TAIJI_REPAIR_SCOPE_INVALID" });
    for (const keyword of ["ship", "production", "ship production"]) expect((await perform("repair", await repairBody(keyword))).status).toBe("evaluated");
    await expect(service.prepare("repair", await repairBody("launch production"), owner)).rejects.toMatchObject({ code: "TAIJI_REPAIR_LIMIT" });
    expect((await current()).versions).toHaveLength(4);
    expect((await current()).activation?.revision).toBe(1);
    expect((await service.status(owner)).runs[0].status).toBe("failed");
  }, 30_000);
});
