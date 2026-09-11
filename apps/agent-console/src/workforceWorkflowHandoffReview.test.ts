import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";
import { runCli } from "./cli-core.js";
import { projectWorkforceWorkflowHandoffReview, assertWorkforceWorkflowOptionsHash } from "./workforceWorkflowHandoffReview.ts";

function stable(value: any): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
const hash = (value: unknown) => `sha256:${createHash("sha256").update(stable(value)).digest("hex")}`;
function handoff(overrides: Record<string, unknown> = {}) {
  const fields = { version: 1, kind: "local-knowledge-report", roleId: "qa", goal: "Review the local release evidence",
    query: "Keep  two spaces in this query", topK: 3, sourceIds: ["second", "first", "second"], outputRootHash: "a".repeat(64), ...overrides };
  return { ...fields, reviewHash: hash(fields) };
}
function approval(withProfile = false): any {
  const role = { version: 1, mode: "gateway-llm-required", profileId: "review-employees", maxTotalRequests: 1, maxConcurrentRoles: 1,
    bindings: [{ roleId: "qa", employeeId: "quality-employee", providerId: "fake", modelId: "local-fixture", maxRequests: 1,
      maxInputTokens: 8192, maxOutputTokens: 2048, timeoutMs: 30000 }] };
  const options = { selectedRoleCount: 1, templateSelected: false, workflowHandoff: handoff(),
    ...(withProfile ? { roleExecution: { ...role, profileHash: hash(role) } } : {}) };
  return { schemaVersion: 1, reviewable: true, effectType: "workforce:execute", policyHash: "sha256:" + "b".repeat(64),
    workforce: { goal: options.workflowHandoff.goal, planId: "local-report-plan", planDigest: "sha256:" + "c".repeat(64),
      autonomyMode: "controlled-execution", options, optionsHash: hash(options) } };
}
async function readApprovals(review: unknown, json = false) {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    requests.push(`${request.method} ${request.url}`);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok", data: { approvals: [{ id: "appr_workflow", agentId: "agt_workflow", toolName: "workforce_execute",
      status: "PENDING", review }] } }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("No fixture address");
  let out = "", err = "";
  try {
    const code = await runCli(["agents", "approvals", "--url", `http://127.0.0.1:${address.port}`, ...(json ? ["--json"] : [])], {
      env: { AGENT_CONSOLE_ADMIN_KEY: "cli-test-admin-key" },
      stdout: { isTTY: false, write: (value: string) => { out += value; } }, stderr: { write: (value: string) => { err += value; } },
    });
    return { code, out, err, requests };
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

test("workflow handoff DTO preserves canonical data and rejects forged or unsafe complete reviews", () => {
  const valid = handoff(); const projected = projectWorkforceWorkflowHandoffReview(valid);
  assert.deepEqual(projected, valid); assert.ok(Object.isFrozen(projected)); assert.ok(Object.isFrozen(projected.sourceIds));
  for (const value of [{ reviewHash: valid.reviewHash }, { ...valid, query: "Changed" }, { ...valid, extra: true },
    handoff({ topK: "3" }), handoff({ topK: 6 }), handoff({ sourceIds: [" "] }), handoff({ sourceIds: Array(33).fill("source") }),
    handoff({ sourceIds: ["x".repeat(257)] }), handoff({ query: "password=private-test-value" }), handoff({ query: "hidden\u202etext" }),
    handoff({ outputRootHash: "A".repeat(64) }), JSON.parse(JSON.stringify(valid).slice(0, -1) + ',"__proto__":{}}')]) {
    assert.throws(() => projectWorkforceWorkflowHandoffReview(value), /invalid or incomplete/);
  }
  let accessed = false;
  const accessor = { ...valid }; Object.defineProperty(accessor, "query", { enumerable: true, get() { accessed = true; return valid.query; } });
  assert.throws(() => projectWorkforceWorkflowHandoffReview(accessor)); assert.equal(accessed, false);
});

test("agents approvals displays every frozen handoff field with and without an employee profile", async () => {
  for (const withProfile of [false, true]) {
    const review = approval(withProfile), expected = review.workforce.options.workflowHandoff;
    expected.sourceIds = [...Array.from({ length: 31 }, (_, index) => `${index}-` + "source".repeat(40)), "last-source"];
    const { reviewHash: _old, ...fields } = expected; expected.reviewHash = hash(fields);
    review.workforce.optionsHash = hash(review.workforce.options);
    const plain = await readApprovals(review);
    assert.equal(plain.code, 0, plain.err); assert.deepEqual(plain.requests, ["GET /v1/approvals"]);
    for (const value of [expected.kind, expected.roleId, expected.goal, expected.query, expected.outputRootHash, expected.reviewHash,
      review.workforce.optionsHash, ...expected.sourceIds]) assert.ok(plain.out.includes(value), `missing ${value}`);
    assert.match(plain.out, /topK: 3/); assert.match(plain.out, /actual artifact has its own write-approval check/);
    const json = await readApprovals(review, true);
    assert.equal(json.code, 0, json.err);
    const projected = JSON.parse(json.out).data[0].review.workforce;
    assert.deepEqual(projected.options.workflowHandoff, expected);
    assertWorkforceWorkflowOptionsHash(projected.options, projected.optionsHash);
    if (withProfile) assert.equal(projected.options.roleExecution.bindings[0].maxInputTokens, 8192);
  }
});

test("agents approvals refuses handoff or options substitutions before printing private intent", async () => {
  const changes = [
    (review: any) => { review.workforce.optionsHash = "sha256:" + "d".repeat(64); },
    (review: any) => { review.workforce.options.workflowHandoff = handoff({ query: "signed replacement query" }); },
    (review: any) => { review.workforce.options.workflowHandoff = handoff({ goal: "Unrelated goal" }); review.workforce.optionsHash = hash(review.workforce.options); },
    (review: any) => { review.workforce.options.workflowHandoff = handoff({ query: "password=private-test-value" }); review.workforce.optionsHash = hash(review.workforce.options); },
    (review: any) => { review.reviewable = false; },
  ];
  for (const change of changes) {
    const review = approval(); change(review);
    for (const json of [false, true]) {
      const result = await readApprovals(review, json);
      assert.equal(result.code, 1); assert.deepEqual(result.requests, ["GET /v1/approvals"]);
      assert.doesNotMatch(result.out + result.err, /private-test-value|local-report-plan|signed replacement query|Unrelated goal/);
    }
  }
});
