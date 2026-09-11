import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";
import { runCli } from "./cli-core.js";
import { projectWorkforceConsensusReview, projectWorkforceConsensusReport } from "./workforceConsensusReview.ts";

const EXECUTION = "wf-scope-" + "c".repeat(64);
function stable(value: any): string { if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`; }
const sha = (value: string) => "sha256:" + createHash("sha256").update(value).digest("hex");
const hash = (value: unknown) => sha(stable(value));
function sealReview(source: any) {
  source.evidence.forEach((item: any) => { item.sha256 = sha(item.content); });
  source.sourceHash = hash({ goal: source.goal, proposal: source.proposal, criteria: source.criteria, evidence: source.evidence });
  const { reviewHash: _old, ...fields } = source; source.reviewHash = hash(fields); return source;
}
function review(): any {
  return sealReview({ version: 1, rule: "any-objection-holds-plan-v1", goal: "Review the original program proposal",
    perspectives: ["Critic", "Planner", "Architect"].map((perspective, index) => ({ perspective, roleId: ["ceo", "pm", "architect"][index],
      employeeId: `employee-${index}`, providerId: "review-provider", modelId: "same-review-model" })),
    proposal: [{ id: "step-one", title: "Keep the original proposal", verification: "Inspect the local program" }],
    criteria: [{ id: "criterion-one", question: "Does the supplied program include its check?", verification: "Read the marked check" }],
    evidence: Array.from({ length: 4 }, (_, index) => ({ id: `source-${index}`, title: `Program ${index}`,
      content: `const expectedSha = "${"a".repeat(64)}";\n// approved local check\n${"x".repeat(3200)}` })) });
}
function approval(): any {
  const source = review(), profile: any = { version: 1, mode: "gateway-llm-required", profileId: "consensus-profile", maxTotalRequests: 3,
    maxConcurrentRoles: 3, bindings: source.perspectives.map((item: any) => ({ roleId: item.roleId, employeeId: item.employeeId,
      providerId: item.providerId, modelId: item.modelId, maxRequests: 1, maxInputTokens: 25000, maxOutputTokens: 5000, timeoutMs: 30000 })).sort((a: any, b: any) => a.roleId.localeCompare(b.roleId)) };
  profile.profileHash = hash(profile);
  const options = { selectedRoleCount: 3, templateSelected: false, roleExecution: profile, consensusReview: source };
  return { schemaVersion: 1, reviewable: true, effectType: "workforce:execute", policyHash: sha("policy"), workforce: { goal: source.goal,
    goalDigest: sha(source.goal), goalBytes: Buffer.byteLength(source.goal), planId: "plan-consensus", planDigest: sha("plan"),
    autonomyMode: "controlled-execution", requiredScopes: ["workforce:execute"], options, optionsHash: hash(options) } };
}
function report(mode = "agree"): any {
  const source = review(), metadata = { version: 1, agentId: "agt_consensus", agentRunId: "agr_consensus", planId: "plan-consensus",
    planDigest: "d".repeat(64), profileHash: sha("profile"), review: source };
  const entries = source.perspectives.map((binding: any, index: number) => {
    const verdict = mode === "revise" && index === 0 ? "contradicted" : "supported";
    const opinion = { version: 1, perspective: binding.perspective, criteria: [{ criterionId: "criterion-one", verdict,
      support: [{ evidenceId: "source-0", quote: "approved local check" }], reason: "This is a recorded model opinion, not established truth.",
      proposedChange: verdict === "supported" ? null : "Add an independently recorded check" }] };
    const responseText = JSON.stringify(opinion), inputHash = String(index + 1).repeat(64);
    return { roleId: binding.roleId, taskId: `task-${index}`, responseText, responseHash: sha(responseText), errorCode: null,
      inputReceipt: { version: 1, profile: "off", messageCount: 2, sourceMessagesHash: sha(`messages-${index}`), gatewayInputHash: inputHash,
        providerInputHash: inputHash, gatewayRequestId: `request-${index}` }, perspective: binding.perspective, employeeId: binding.employeeId,
      opinion, contributionStatus: "opinion" };
  });
  const missing = mode === "missing", count = missing ? 2 : 3;
  if (missing) Object.assign(entries[2], { responseText: null, responseHash: null, errorCode: null, inputReceipt: null, opinion: null, contributionStatus: "not_observed" });
  const receipts = source.perspectives.slice(0, count).map((binding: any, index: number) => ({ roleId: binding.roleId, employeeId: binding.employeeId,
    taskId: `task-${index}`, receipt: { version: 1, level: "gateway-provider-operation", status: "succeeded", executionMode: "real",
      gatewayRequestId: `request-${index}`, providerId: binding.providerId, modelId: binding.modelId, providerCallAttempted: true,
      inputTokens: 10, outputTokens: null, totalTokens: null, estimatedCostUsd: null, errorCode: null } }));
  const assessments = entries.filter((entry: any) => entry.opinion).map((entry: any) => ({ ...entry.opinion.criteria[0], perspective: entry.perspective }));
  const requiredRevisions = assessments.filter((item: any) => item.proposedChange).map((item: any) => ({ criterionId: item.criterionId,
    perspective: item.perspective, proposedChange: item.proposedChange, reason: item.reason }));
  const incomplete = missing || mode === "cancelled";
  const result: any = { version: 1, executionId: EXECUTION, metadata, executionStatus: mode === "cancelled" ? "cancelled" : "completed",
    status: incomplete ? "incomplete" : "complete", independentInputsVerified: !incomplete, evidenceLevel: "real-model-responses",
    semanticTruthVerified: false, automaticallyExecutedPlan: false, entries, receipts, dispatchCount: count,
    usage: { source: "gateway-provider-operation-receipts", networkRetryCountKnown: false, costUsd: null, inputTokens: count * 10, outputTokens: null },
    decision: { version: 1, rule: source.rule, sourceHash: source.sourceHash, reviewHash: source.reviewHash,
      status: incomplete ? "incomplete" : requiredRevisions.length ? "revise" : "recommend-proceed", missingPerspectives: missing ? ["Architect"] : [],
      criteria: [{ criterionId: "criterion-one", disagreement: requiredRevisions.length > 0, assessments }],
      proposedPlan: { goal: source.goal, steps: source.proposal, requiredRevisions }, holdExecution: true, requiresNewApproval: true } };
  result.reportHash = hash(result); return result;
}
async function call(data: any, command: "approvals" | "status", json = true) {
  const requests: string[] = [];
  const server = createServer((request, response) => { requests.push(`${request.method} ${request.url}`); response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok", data: command === "approvals" ? { approvals: [{ id: "appr_consensus", agentId: "agt_consensus", toolName: "workforce_execute", status: "PENDING", review: data }] } : data })); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve)); const address = server.address(); if (!address || typeof address === "string") throw new Error("No fixture address");
  let out = "", err = "";
  try {
    const code = await runCli([...(command === "approvals" ? ["agents", "approvals"] : ["workforce", "status", EXECUTION]), "--url", `http://127.0.0.1:${address.port}`, ...(json ? ["--json"] : [])], {
      env: { AGENT_CONSOLE_ADMIN_KEY: "consensus-cli-fixture-key" }, stdout: { isTTY: false, write: (value: string) => { out += value; } }, stderr: { write: (value: string) => { err += value; } } });
    return { code, out, err, requests, data: json ? JSON.parse(out || err) : null };
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}
const status = (value: any) => ({ planId: EXECUTION, status: value.executionStatus, consensusReport: value, consensusObservation: "recorded" });

test("consensus approvals preserve full multiline code, long hashes, all sources and bound perspectives", async () => {
  const source = approval(), plain = await call(source, "approvals", false); assert.equal(plain.code, 0, plain.err); assert.ok(plain.out.length > 4096);
  for (const item of source.workforce.options.consensusReview.evidence) { assert.ok(plain.out.includes(item.content)); assert.ok(plain.out.includes(item.sha256)); }
  for (const item of source.workforce.options.consensusReview.perspectives) assert.ok(plain.out.includes(item.employeeId));
  const json = await call(source, "approvals"); assert.equal(json.code, 0, json.err);
  const projected = json.data.data[0].review.workforce; assert.deepEqual(projected.options, source.workforce.options); assert.equal(hash(projected.options), projected.optionsHash);
  assert.deepEqual(plain.requests, ["GET /v1/approvals"]);
});
test("consensus approvals reject changed body, source hashes and bindings before displaying material", async () => {
  for (const change of [(value: any) => { value.workforce.goalBytes++; }, (value: any) => { value.workforce.optionsHash = sha("forged"); },
    (value: any) => { value.workforce.options.consensusReview.evidence[0].content = "replacement source"; },
    (value: any) => { value.workforce.options.consensusReview.sourceHash = sha("forged"); },
    (value: any) => { value.workforce.options.roleExecution.bindings[0].employeeId = "another-employee"; },
    (value: any) => { value.workforce.options.runPlanImmediately = true; value.workforce.optionsHash = hash(value.workforce.options); },
    (value: any) => { const item = value.workforce.options.consensusReview; item.evidence[0].content = "api_key=private-material"; sealReview(item); value.workforce.optionsHash = hash(value.workforce.options); },
    (value: any) => { const item = value.workforce.options.consensusReview; item.evidence[0].content = "PASSWORD=abcd"; sealReview(item); value.workforce.optionsHash = hash(value.workforce.options); },
    (value: any) => { const item = value.workforce.options.consensusReview; item.evidence[0].id = "unsupported/source"; sealReview(item); value.workforce.optionsHash = hash(value.workforce.options); }]) {
    const source = approval(); change(source); const response = await call(source, "approvals"); assert.equal(response.code, 1);
    assert.doesNotMatch(response.out + response.err, /private-material|replacement source|Program 0/);
  }
});
test("consensus status preserves recorded opinions, complete receipts and unknown usage while holding execution", async () => {
  const source = report(), response = await call(status(source), "status"); assert.equal(response.code, 0, response.err);
  assert.equal(response.data.status, "advice-recorded"); assert.deepEqual(response.data.data.consensusReport, source);
  assert.equal(response.data.data.consensusReport.usage.outputTokens, null); assert.match(response.data.nextAction, /requires new approval/);
  assert.match(response.data.nextAction, /not verified semantic truth/); assert.deepEqual(response.requests, ["POST /workforce/execute/status"]);
  for (const mode of ["revise", "missing", "cancelled"]) {
    const source = report(mode), response = await call(status(source), "status"); assert.equal(response.code, 0, response.err);
    assert.equal(response.data.status, mode === "revise" ? "revision-required" : "incomplete"); assert.deepEqual(response.data.data.consensusReport, source);
  }
  const unknown = report("missing"), failedReceipt = report().receipts[2];
  Object.assign(failedReceipt.receipt, { status: "outcome_unknown", executionMode: "unknown", gatewayRequestId: null, providerId: null, modelId: null,
    providerCallAttempted: null, inputTokens: null, outputTokens: null, totalTokens: null, errorCode: "WORKFORCE_ROLE_PROVIDER_FAILED" });
  unknown.receipts.push(failedReceipt); unknown.dispatchCount = 3; unknown.usage.inputTokens = null; unknown.evidenceLevel = "synthetic-or-incomplete-responses";
  Object.assign(unknown.entries[2], { errorCode: "WORKFORCE_ROLE_PROVIDER_FAILED", contributionStatus: "failed" });
  const { reportHash: _old, ...unknownFields } = unknown; unknown.reportHash = hash(unknownFields);
  const unknownResponse = await call(status(unknown), "status"); assert.equal(unknownResponse.code, 0, unknownResponse.err);
  assert.deepEqual(unknownResponse.data.data.consensusReport, unknown); assert.equal(unknownResponse.data.data.consensusReport.usage.inputTokens, null);
  const absent = await call({ planId: EXECUTION, status: "running", consensusReport: null, consensusObservation: "not-recorded-no-automatic-redispatch" }, "status");
  assert.equal(absent.code, 0); assert.equal(absent.data.data.consensusReport, null); assert.match(absent.data.nextAction, /No consensus report/);
});
test("consensus status rejects resealed cross-execution, altered decisions, usage and input proof associations", async () => {
  for (const change of [(value: any) => { value.executionId = "other-execution"; }, (value: any) => { value.entries[0].responseHash = sha("forged"); },
    (value: any) => { value.entries[0].inputReceipt.providerInputHash = "e".repeat(64); },
    (value: any) => { value.decision.requiresNewApproval = false; }, (value: any) => { value.semanticTruthVerified = true; },
    (value: any) => { value.usage.outputTokens = 0; }, (value: any) => { value.independentInputsVerified = false; },
    (value: any) => { value.entries[1].inputReceipt.sourceMessagesHash = value.entries[0].inputReceipt.sourceMessagesHash; },
    (value: any) => { value.entries[0].responseText = value.entries[0].responseText.replace('"version":1,', '"version":1,"version":1,'); value.entries[0].responseHash = sha(value.entries[0].responseText); }]) {
    const source = report(); change(source); const { reportHash: _old, ...fields } = source; source.reportHash = hash(fields);
    const response = await call(status(source), "status"); assert.equal(response.code, 1); assert.equal(response.data.status, "failed"); assert.doesNotMatch(response.err, /Program 0/);
  }
  let accessed = false; const source = review(); Object.defineProperty(source.evidence[0], "content", { enumerable: true, get() { accessed = true; return "unexpected"; } });
  assert.throws(() => projectWorkforceConsensusReview(source)); assert.equal(accessed, false);
  const current = report(); assert.throws(() => projectWorkforceConsensusReport({ reportHash: current.reportHash }, EXECUTION, "completed"));
});
