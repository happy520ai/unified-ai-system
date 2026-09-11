import test from "node:test";
import assert from "node:assert/strict";
import { executeSandboxAutoRuntime } from "./sandboxAutoRuntimeExecutor.js";
import { describeRuntimeProfiles, digest, normalizeProfileArguments, runtimeProfileHash, verifyProfileArtifact } from "./sandboxRuntimeProfiles.ts";
import type { RuntimeProfileId } from "./sandboxRuntimeProfiles.ts";
import type { SandboxRuntimeContext } from "./sandboxRuntime.ts";

const context = (): SandboxRuntimeContext => ({ enabled: () => true, assertActive: async () => {} });
const request = (profileId: RuntimeProfileId, args: unknown) => ({
  capability: { capabilityId: "test-capability", profileId, implementationHash: runtimeProfileHash(profileId) },
  lease: { leaseId: "owned-test", capabilityId: "test-capability", expiresAt: Date.now() + 60_000,
    maxRequests: 3, maxTokenBudget: 4000, maxRuntimeMs: 10_000 }, arguments: args,
});

test("a passed preview and caller-reported metrics cannot prove an execution", async () => {
  const result = await executeSandboxAutoRuntime({
    capability: { capabilityId: "no-executor" },
    lease: { leaseId: "preview", maxRequests: 3, maxTokenBudget: 4000, maxRuntimeMs: 30000 },
    dryRunResult: { status: "passed" }, durationMs: 5, tokenEstimate: 600,
  });
  assert.equal(result.executionStatus, "blocked");
  assert.equal(result.actualExecution, false);
  assert.equal(result.artifact, null);
});

test("a real isolated worker produces recoverable context and measured zero-model usage", async () => {
  const facts = [{ key: "目标", value: "A\\B\nC", reference: "doc:17" }, { key: "approved", value: false },
    { key: "count", value: 12 }, { key: "missing", value: null }];
  const result = await executeSandboxAutoRuntime({ ...request("context-jsonl-v1", { facts }), durationMs: -99, tokenEstimate: 600 }, context());
  assert.equal(result.executionStatus, "passed", result.blockedReason ?? "");
  assert.equal(result.actualExecution, true); assert.equal(result.workerClosed, true);
  assert.deepEqual(result.artifact?.content.split("\n").map(line => JSON.parse(line)), facts);
  assert.equal(result.tokensUsed, 0); assert.equal(result.measuredUsage.tokens, 0);
  assert.equal(result.requestCount, 1); assert.ok(result.durationMs > 0); assert.notEqual(result.durationMs, -99);
  assert.equal(result.artifact?.sha256, digest(result.artifact!.content));
});

test("risk classification checks a specified postcondition and cannot hide an unmet one", async () => {
  const good = await executeSandboxAutoRuntime(request("risk-classification-v1", { text: "deploy release", expectedSignals: ["deploy_release"] }), context());
  assert.equal(good.executionStatus, "passed", good.blockedReason ?? "");
  assert.deepEqual(JSON.parse(good.artifact!.content).signals, ["deploy_release"]);
  const bad = await executeSandboxAutoRuntime(request("risk-classification-v1", { text: "deploy release", expectedSignals: [] }), context());
  assert.equal(bad.executionStatus, "failed"); assert.equal(bad.blockedReason, "TAIJI_VERIFICATION_FAILED");
  assert.equal(bad.artifact, null); assert.equal(bad.workerClosed, true);
});

test("evidence output preserves first failure after a later success and keeps unknown separate", async () => {
  const records = [{ id: "gate", attempt: 2, status: "passed", evidenceSha256: digest("green") },
    { id: "gate", attempt: 1, status: "failed", evidenceSha256: digest("red") },
    { id: "remote", attempt: 1, status: "unknown", evidenceSha256: digest("no receipt") }];
  const result = await executeSandboxAutoRuntime(request("evidence-summary-v1", { records }), context());
  assert.equal(result.executionStatus, "passed", result.blockedReason ?? "");
  const output = JSON.parse(result.artifact!.content);
  assert.equal(output.attempts.length, 3);
  assert.deepEqual(output.results, [{ id: "gate", currentStatus: "passed", firstFailureAttempt: 1, attempts: 2 },
    { id: "remote", currentStatus: "unknown", firstFailureAttempt: null, attempts: 1 }]);
});

test("invalid input, changed implementation, missing authority and invalid budgets never spawn", async () => {
  const base = request("context-jsonl-v1", { facts: [{ key: "a", value: 1 }] });
  const invalid = [
    { ...base, arguments: { facts: [], code: "process.exit(0)" } },
    { ...base, capability: { ...base.capability, implementationHash: digest("old implementation") } },
    ...[NaN, -1, Infinity, 30_001].map(maxRuntimeMs => ({ ...base, lease: { ...base.lease, maxRuntimeMs } })),
    { ...base, lease: { ...base.lease, expiresAt: Date.now() - 1 } },
  ];
  for (const input of invalid) {
    const result = await executeSandboxAutoRuntime(input, context());
    assert.equal(result.executionStatus, "blocked"); assert.equal(result.actualExecution, false); assert.equal(result.workerClosed, true);
  }
  const result = await executeSandboxAutoRuntime(base, { ...context(), assertActive: async () => { throw new Error("revoked"); } });
  assert.equal(result.executionStatus, "blocked"); assert.equal(result.actualExecution, false);
});

test("cancel, deadline and kill switch close the owned worker without a late success", async () => {
  const base = request("context-jsonl-v1", { facts: [{ key: "a", value: 1 }] });
  const timed = await executeSandboxAutoRuntime({ ...base, lease: { ...base.lease, maxRuntimeMs: 1 } }, context());
  // A deadline can be spent in preflight before the worker is created, or in
  // the worker. Both must return the same timeout reason without an artifact.
  assert.equal(timed.executionStatus, timed.actualExecution ? "failed" : "blocked");
  assert.equal(timed.blockedReason, "TAIJI_RUNTIME_TIMEOUT"); assert.equal(timed.workerClosed, true); assert.equal(timed.artifact, null);
  const controller = new AbortController();
  const pending = executeSandboxAutoRuntime(base, { ...context(), signal: controller.signal });
  setImmediate(() => controller.abort());
  const cancelled = await pending; assert.equal(cancelled.executionStatus, "cancelled"); assert.equal(cancelled.actualExecution, true); assert.equal(cancelled.workerClosed, true);
  let enabled = true;
  const killed = executeSandboxAutoRuntime(base, { ...context(), enabled: () => enabled });
  setImmediate(() => { enabled = false; });
  const result = await killed; assert.notEqual(result.executionStatus, "passed"); assert.equal(result.blockedReason, "TAIJI_RUNTIME_DISABLED");
  assert.equal(result.workerClosed, true);
});

test("independent recovery rejects invented, omitted or modified facts even with a valid output hash", () => {
  const args = normalizeProfileArguments("context-jsonl-v1", { facts: [{ key: "amount", value: 7 }, { key: "approved", value: false }] });
  for (const content of ['{"key":"amount","value":7}', '{"key":"amount","value":8}\n{"key":"approved","value":false}',
    '{"key":"amount","value":7,"extra":true}\n{"key":"approved","value":false}']) {
    assert.throws(() => verifyProfileArtifact("context-jsonl-v1", args, { mediaType: "application/x-ndjson", content,
      sha256: digest(content), bytes: Buffer.byteLength(content) }));
  }
  assert.equal(describeRuntimeProfiles().length, 3);
});
