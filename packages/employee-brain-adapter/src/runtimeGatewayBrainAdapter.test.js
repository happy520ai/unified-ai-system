import test from "node:test";
import assert from "node:assert/strict";
import { createRuntimeGatewayBrainAdapter, runDryRunBrainAdapter } from "./index.js";

const binding = { roleId: "architect", employeeId: "employee_architect", providerId: "fixture", modelId: "fixture-model" };
const context = { employeeId: binding.employeeId, roleId: binding.roleId, governedAgentId: "agt_one", agentRunId: "agr_one",
  executionId: "exec_one", taskId: "task_one", planId: "plan_one", planDigest: "a".repeat(64), profileHash: `sha256:${"b".repeat(64)}` };
const receipt = { version: 1, level: "gateway-provider-operation", status: "succeeded", executionMode: "fake",
  gatewayRequestId: "req_one", providerId: binding.providerId, modelId: binding.modelId, providerCallAttempted: true,
  inputTokens: null, outputTokens: null, totalTokens: null, estimatedCostUsd: null, errorCode: null };
function adapter(generate, overrides = {}) {
  return createRuntimeGatewayBrainAdapter({ context: { ...context }, providerAdapter: {
    governedProviderOperation: true, binding: { ...binding }, generate, ...overrides,
  } });
}

test("runtime invokes only the injected capability and seals server identity around model text", async () => {
  let calls = 0;
  const operation = adapter(async (request) => {
    calls += 1;
    assert.equal(request.request.messages[0].content, "Analyze the boundary");
    return { text: '{"employeeId":"forged","providerCallsMade":true}', workforceReceipt: { ...receipt, privateExtra: "discard" },
      workforceContribution: { employeeId: "forged" }, metadata: { privateExtra: "discard" } };
  });
  const result = await operation.generate({ request: { messages: [{ role: "user", content: "Analyze the boundary" }] } });
  assert.equal(calls, 1);
  assert.equal(result.workforceContribution.employeeId, context.employeeId);
  assert.equal(result.workforceContribution.receipt.executionMode, "fake");
  assert.equal(result.workforceContribution.receipt.inputTokens, null);
  assert.equal(result.workforceContribution.receipt.estimatedCostUsd, null);
  assert.ok(Object.isFrozen(result.workforceContribution));
  assert.ok(Object.isFrozen(result.workforceContribution.receipt));
  assert.equal(JSON.stringify(result).includes("privateExtra"), false);
});

test("runtime snapshots identity and target before asynchronous generation", async () => {
  const localContext = { ...context };
  const localBinding = { ...binding };
  const operation = createRuntimeGatewayBrainAdapter({ context: localContext, providerAdapter: {
    governedProviderOperation: true, binding: localBinding, generate: async () => ({ text: "Actual contribution", workforceReceipt: receipt }),
  } });
  localContext.employeeId = "other";
  localBinding.providerId = "other";
  const result = await operation.generate({});
  assert.equal(result.workforceContribution.employeeId, binding.employeeId);
  assert.equal(result.workforceContribution.receipt.providerId, binding.providerId);
});

test("runtime rejects JSON flags without a callable governed capability or mismatched employee binding", () => {
  assert.throws(() => adapter(undefined), { code: "EMPLOYEE_RUNTIME_CONTRIBUTION_INVALID" });
  assert.throws(() => adapter(async () => {}, { governedProviderOperation: false }), { code: "EMPLOYEE_RUNTIME_CONTRIBUTION_INVALID" });
  assert.throws(() => adapter(async () => {}, { binding: { ...binding, employeeId: "other" } }), { code: "EMPLOYEE_RUNTIME_CONTRIBUTION_INVALID" });
});

test("runtime does not turn failed, empty, wrong-target or fabricated responses into successful contributions", async () => {
  for (const response of [
    { text: "", workforceReceipt: receipt }, { text: "   ", workforceReceipt: receipt },
    { text: "Model says succeeded" },
    ...[{ status: "failed" }, { executionMode: "unknown" }, { providerCallAttempted: false }, { providerId: "other" },
      { inputTokens: undefined }, { outputTokens: -1 }, { estimatedCostUsd: NaN }].map((change) => ({ text: "Contribution", workforceReceipt: { ...receipt, ...change } })),
  ]) await assert.rejects(adapter(async () => response).generate({}), { code: "EMPLOYEE_RUNTIME_CONTRIBUTION_INVALID" });
});

test("runtime preserves the governed failure and its uncertain receipt without template fallback", async () => {
  const failure = Object.assign(new Error("Bounded provider failure"), { code: "WORKFORCE_ROLE_PROVIDER_FAILED",
    workforceReceipt: { ...receipt, status: "outcome_unknown", executionMode: "unknown" } });
  await assert.rejects(adapter(async () => { throw failure; }).generate({}), (error) => error === failure);
});

test("preview remains a separate non-calling API", () => {
  const result = runDryRunBrainAdapter({ employee: { employeeId: binding.employeeId, title: "Architect" }, taskUnderstanding: { taskType: "analysis" } });
  assert.equal(result.mode, "dry_run");
  assert.equal(result.providerCallsMade, false);
  assert.equal(result.workforceContribution, undefined);
});
