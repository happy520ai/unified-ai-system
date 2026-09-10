import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, realpath, rm, writeFile, link } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { runCli, parseCliArgs, CliUsageError } from "./cli-core.js";
import { projectForgeApprovalReview, projectTaijiApprovalReview } from "./operatorCommands.ts";

type Call = { path: string; body: any; authorization?: string; dispatchKey?: string };
async function fixture() {
  const calls: Call[] = []; let variant = "normal";
  const server = createServer(async (request, response) => {
    let raw = ""; for await (const chunk of request) raw += chunk;
    const body = raw ? JSON.parse(raw) : undefined;
    calls.push({ path: request.url!, body, authorization: request.headers.authorization, dispatchKey: request.headers["provider-dispatch-key"] as string });
    let data: any = { ok: true };
    if (request.url === "/knowledge/health") data = { status: "ready", mode: "local-keyword", storage: "memory", sourceCount: 2, documentCount: 2, chunkCount: 2, supportedModes: ["keyword"], persistence: {} };
    if (request.url === "/knowledge/sources") data = { sources: [{ sourceId: "one", title: "First", documentCount: variant === "bad-count" ? "unknown" : 1, documents: [] }, { sourceId: "two", title: "Second", documentCount: 1, documents: [] }] };
    if (request.url === "/knowledge/load") data = { status: "loaded", sourceId: body.sourceId, loadedCount: body.documents.length, sourceCount: 2,
      documentCount: body.documents.length, documents: body.documents.map((document: any, index: number) => ({ sourceId: body.sourceId, documentId: document.documentId ?? `loaded-document-${index + 1}` })) };
    if (request.url === "/knowledge/retrieve") data = { query: body.query, mode: body.mode, chunks: [{ id: "chunk", text: "approved result", document: { sourceId: "one", documentId: "doc" } }] };
    if (request.url === "/route/modes") data = { modes: ["fake", "real", "auto"], routeModes: ["fixed", "registry-default"] };
    if (request.url?.startsWith("/routing/")) data = { success: true, mode: request.url.includes("quality-cost") ? "local-quality-cost-routing-preview-only" : "local-routing-preview-only",
      answerPath: "model", modelTier: "cheap", providerRecommendation: "local", modelRecommendation: "preview", requiresPaidApi: false, requiresApproval: false,
      shouldBlock: false, paidApiCallCount: variant === "fake-preview" ? 1 : 0, externalApiCalled: variant === "fake-preview", routingReason: "Local simulated choice" };
    if (request.url === "/forge/status") data = { enabled: true };
    if (request.url === "/forge/runs") data = { ok: true, total: 1, runs: [{ runId: "forge_fixture", status: "completed", startedAt: "2026-09-10T00:00:00Z", goalPreview: "bounded goal" }] };
    if (request.url === "/forge/polish") data = { ok: true, result: { code: "Improved output", finalScore: 88 }, passes: 1, durationMs: 2 };
    if (request.url === "/forge/quality") data = { ok: true, evaluation: { passed: variant !== "bad-quality", score: 88 } };
    if (request.url === "/forge/memory") data = body.action === "remember" ? { ok: true, id: "memory-one" } : { ok: true, working: { entries: [{ content: "memo" }] }, semantic: [] };
    if (request.url === "/taiji/compile") data = { spec: { description: body.request }, risk: { level: "low" }, manifest: { status: "draft" } };
    if (request.url === "/workforce/preview") data = { route: "/workforce/preview", preview: { mode: "dry-run", task: body.task } };
    if (request.url?.startsWith("/taiji/capabilities?")) data = { enabled: true, profiles: [], capabilities: [], runs: [], capabilityCount: 0, runCount: 0 };
    if (request.url?.startsWith("/taiji/capabilities/runs/") || request.url === "/taiji/capabilities/execute") {
      const content = '{"key":"approved","value":false}';
      data = { status: "passed", run: { id: body?.runId ?? "run_fixture", capabilityId: body?.capabilityId ?? "facts", revision: 1, status: "passed", result: { actualExecution: true, workerClosed: true,
        modelUsage: { unit: "tokens", total: 0, requests: 0 }, artifact: { content: variant === "bad-taiji-artifact" ? "changed" : content,
          mediaType: "application/x-ndjson", bytes: Buffer.byteLength(content), sha256: "sha256:" + createHash("sha256").update(content).digest("hex") } } } };
    }
    if (["/taiji/capabilities/evaluate", "/taiji/capabilities/activate"].includes(request.url!)) {
      response.statusCode = 202; data = { status: "approval_required", approvalId: "apr_taiji", agentId: body.agentId, toolName: "taiji_capability" };
    }
    if (request.url === "/forge/orchestrate") {
      if (variant === "approval") { response.statusCode = 202; data = { outcome: "approval_required", approvalId: "apr_fixture", agentId: body.agentId, toolName: "forge_orchestrate", code: "TOOL_APPROVAL_REQUIRED" }; }
      else data = { ok: true, runId: "forge_fixture", result: { status: "completed", completedTasks: 1, failedTasks: 0 } };
    }
    if (variant === "unknown") { response.writeHead(503, { "content-type": "application/json" }); response.end(JSON.stringify({ status: "error", error: {
      code: "FORGE_EXTERNAL_EFFECT_OUTCOME_UNCERTAIN", message: "api_key=fixture-secret-value", details: { outcomeUnknown: true, reconciliation: { runId: "forge_fixture" } } } })); return; }
    if (variant === "sensitive") data = { ...data, apiKey: "fixture-private", label: "\u001b[31mBearer fixture-private-token\rforged" };
    response.setHeader("content-type", "application/json"); response.end(JSON.stringify({ status: "ok", data }));
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${(server.address() as any).port}`;
  async function run(args: string[], json = true) {
    let out = "", err = "";
    const code = await runCli([...args, "--url", baseUrl, ...(json ? ["--json"] : [])], { env: { AGENT_CONSOLE_ADMIN_KEY: "operator-fixture-key" },
      stdout: { isTTY: false, write: (value: string) => { out += value; } }, stderr: { write: (value: string) => { err += value; } } });
    return { code, out, err, data: json ? JSON.parse(out || err) : null };
  }
  return { calls, run, variant(value: string) { variant = value; }, async close() { await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }); } };
}

test("operator flags remain scoped and unknown operations fail before requests", () => {
  assert.equal(parseCliArgs(["knowledge", "load", "--help"], {}).command, "help");
  assert.equal(parseCliArgs(["knowledge", "sources", "--limit", "1", "--offset", "1"], {}).lifecycleOffset, 1);
  for (const args of [["chat", "--input", "unused.json"], ["knowledge", "sources", "--yes"], ["routing", "modes", "--source-id", "a"],
    ["forge", "status", "--agent-id", "agt_fixture"], ["forge", "shell"], ["knowledge", "sources", "--url", "http://user:password@127.0.0.1"]]) assert.throws(() => parseCliArgs(args, {}), CliUsageError);
});

test("knowledge import is a concrete preview until confirmed and verification uses the same SDK", async () => {
  const gateway = await fixture(), temporaryRoot = await realpath(tmpdir()), root = await mkdtemp(join(temporaryRoot, "uai-operator-input-"));
  try {
    const input = join(root, "documents.json"); await writeFile(input, JSON.stringify({ sourceId: "one", documents: [{ documentId: "doc", content: "approved source content" }] }));
    const preview = await gateway.run(["knowledge", "load", "--input", input]);
    assert.equal(preview.code, 0); assert.equal(preview.data.status, "preview"); assert.equal(gateway.calls.length, 0);
    assert.equal(preview.out.includes("approved source content"), false);
    const loaded = await gateway.run(["knowledge", "load", "--input", input, "--yes"]);
    assert.equal(loaded.code, 0); assert.equal(loaded.data.data.loadedCount, 1); assert.equal(loaded.data.requestDigest, preview.data.requestDigest);
    assert.equal(gateway.calls[0].path, "/knowledge/load"); assert.equal(gateway.calls[0].body.documents[0].content, "approved source content");
    assert.equal(gateway.calls[0].authorization, "Bearer operator-fixture-key");
    const sources = await gateway.run(["knowledge", "sources", "--limit", "1", "--offset", "1"]);
    assert.equal(sources.data.data.total, 2); assert.equal(sources.data.data.sources[0].sourceId, "two");
    const retrieved = await gateway.run(["knowledge", "retrieve", "approved", "--source-id", "one", "--limit", "1"]);
    assert.equal(retrieved.code, 0); assert.equal(retrieved.data.data.chunks[0].text, "approved result");
    assert.equal(gateway.calls.at(-1)!.body.mode, "keyword");
    const before = gateway.calls.length;
    const vector = await gateway.run(["knowledge", "retrieve", "approved", "--mode", "vector"]);
    assert.equal(vector.code, 2); assert.equal(gateway.calls.length, before);
    assert.equal((await gateway.run(["knowledge", "retrieve", "approved", "--mode", "vector", "--allow-real-provider"])).code, 0);
  } finally { await gateway.close(); const owned = await realpath(root); assert.equal(dirname(owned), temporaryRoot); assert.ok(basename(owned).startsWith("uai-operator-input-")); await rm(owned, { recursive: true, force: true }); }
});

test("payload files reject bad JSON, credentials, hard links and oversize without sending", async () => {
  const gateway = await fixture(), temporaryRoot = await realpath(tmpdir()), root = await mkdtemp(join(temporaryRoot, "uai-operator-input-"));
  try {
    for (const [name, value] of [["bad.json", "{"], ["credentials.json", JSON.stringify({ sourceId: "x", documents: [{ content: "okay" }], metadata: { apiKey: "secret" } })], ["large.json", " ".repeat(1048577)]]) {
      const path = join(root, name); await writeFile(path, value);
      const result = await gateway.run(["knowledge", "load", "--input", path, "--yes"]); assert.equal(result.code, 2);
      assert.equal(result.data.status, "rejected"); assert.equal(gateway.calls.length, 0);
    }
    const path = join(root, "linked.json"); await writeFile(path, JSON.stringify({ sourceId: "x", documents: [{ content: "okay" }] })); await link(path, join(root, "second-link.json"));
    assert.equal((await gateway.run(["knowledge", "load", "--input", path, "--yes"])).code, 2); assert.equal(gateway.calls.length, 0);
  } finally { await gateway.close(); const owned = await realpath(root); assert.equal(dirname(owned), temporaryRoot); assert.ok(basename(owned).startsWith("uai-operator-input-")); await rm(owned, { recursive: true, force: true }); }
});

test("routing calls only actual preview routes and validates the no-model result", async () => {
  const gateway = await fixture();
  try {
    assert.equal((await gateway.run(["routing", "modes"])).code, 0);
    for (const mode of ["answer-path", "quality-cost"]) {
      const result = await gateway.run(["routing", "preview", "a bounded query", "--mode", mode]);
      assert.equal(result.code, 0); assert.equal(result.data.data.externalApiCalled, false); assert.equal(gateway.calls.at(-1)!.path, `/routing/${mode}/preview`);
      assert.equal(result.data.status, "preview");
    }
    assert.equal(gateway.calls.some(call => call.path === "/route"), false);
    gateway.variant("fake-preview"); assert.equal((await gateway.run(["routing", "preview", "x"])).code, 1);
    gateway.variant("bad-count"); assert.equal((await gateway.run(["knowledge", "sources"])).code, 1);
  } finally { await gateway.close(); }
});

test("Forge approval projection preserves verified budgets and rejects changed target material", () => {
  const canonical = (value: any): string => Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
    : value && typeof value === "object" ? `{${Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + canonical(value[key])).join(",")}}` : JSON.stringify(value);
  const digest = (value: string) => "sha256:" + createHash("sha256").update(value).digest("hex");
  const goal = "approved code task", options = { enableCodeIntel: false, maxOutputTokens: 1024, budget: { maxTokens: 20000, maxCost: 2 }, modelSelection: { providerId: "local-fake-provider", modelId: "local-fake-model" } };
  const review = { schemaVersion: 1, reviewable: true, effectType: "forge:orchestrate", policyHash: digest("policy"),
    forge: { goal, goalDigest: digest(goal), goalBytes: Buffer.byteLength(goal), options, optionsHash: digest(canonical(options)) } };
  assert.equal(projectForgeApprovalReview(review).forge.options.budget.maxTokens, 20000);
  assert.throws(() => projectForgeApprovalReview({ ...review, forge: { ...review.forge, goal: "changed task" } }));
  assert.throws(() => projectForgeApprovalReview({ ...review, forge: { ...review.forge, options: { ...options, maxOutputTokens: 4096 } } }));
});

test("Forge previews, fake selection, explicit real opt-in, approvals and unknown outcomes are not conflated", async () => {
  const gateway = await fixture();
  try {
    const preview = await gateway.run(["forge", "polish", "draft"]);
    assert.equal(preview.code, 0); assert.equal(preview.data.status, "preview"); assert.equal(gateway.calls.length, 0);
    assert.deepEqual(preview.data.request.modelSelection, { providerId: "local-fake-provider", modelId: "local-fake-model" });
    const polished = await gateway.run(["forge", "polish", "draft", "--yes", "--passes", "1"], false);
    assert.equal(polished.code, 0); assert.match(polished.out, /Improved output/); assert.ok(gateway.calls[0].dispatchKey);
    const before = gateway.calls.length;
    assert.equal((await gateway.run(["forge", "polish", "draft", "--yes", "--provider-id", "real-provider", "--model-id", "model"])).code, 2);
    assert.equal(gateway.calls.length, before);
    assert.equal((await gateway.run(["forge", "polish", "draft", "--yes", "--provider-id", "real-provider", "--model-id", "model", "--allow-real-provider"])).code, 0);
    assert.equal(gateway.calls.at(-1)!.body.modelSelection.providerId, "real-provider");
    const args = ["forge", "orchestrate", "--goal", "bounded goal", "--agent-id", "agt_fixture", "--yes"];
    gateway.variant("approval"); const approval = await gateway.run(args);
    assert.equal(approval.code, 3); assert.equal(approval.data.status, "approval_required"); assert.match(approval.data.nextAction, /agents approvals/);
    assert.equal(gateway.calls.at(-1)!.body.options.modelSelection.providerId, "local-fake-provider");
    assert.equal(gateway.calls.some(call => call.path.includes("approvals/decide")), false);
    gateway.variant("unknown"); const unknown = await gateway.run(args);
    assert.equal(unknown.code, 1); assert.equal(unknown.data.status, "unknown-reconcile-required"); assert.equal(unknown.data.retryAllowed, false); assert.equal(unknown.data.runId, "forge_fixture");
    assert.equal(unknown.err.includes("fixture-secret-value"), false);
    gateway.variant("sensitive"); const status = await gateway.run(["forge", "status"]);
    assert.equal(status.out.includes("fixture-private"), false); assert.equal(status.out.includes("\u001b"), false);
    assert.equal(status.out.includes("\r"), false);
  } finally { await gateway.close(); }
});

test("Forge static tools, session memory and previews report their actual result", async () => {
  const gateway = await fixture();
  try {
    for (const args of [["forge", "status"], ["forge", "runs"], ["forge", "quality", "export const x=1"], ["forge", "memory", "memo", "--yes"],
      ["forge", "recall", "memo"], ["forge", "taiji", "draft a capability"], ["forge", "workforce", "preview a task"]]) assert.equal((await gateway.run(args)).code, 0);
    gateway.variant("bad-quality"); const result = await gateway.run(["forge", "quality", "bad code"]);
    assert.equal(result.code, 1); assert.equal(result.data.status, "not_completed");
  } finally { await gateway.close(); }
});

test("Taiji CLI previews mutations, preserves Agent targets, handles approval and verifies recorded bytes", async () => {
  const gateway = await fixture(), parent = await realpath(tmpdir()), root = await mkdtemp(join(parent, "uai-operator-taiji-"));
  try {
    const file = join(root, "operation.json");
    await writeFile(file, JSON.stringify({ capabilityId: "facts", expectedLifecycleRevision: 0, request: "Preserve facts", profileId: "context-jsonl-v1" }));
    const args = ["taiji", "evaluate", "--agent-id", "agt_fixture", "--input", file];
    const preview = await gateway.run(args); assert.equal(preview.code, 0, preview.err); assert.equal(preview.data.status, "preview"); assert.equal(gateway.calls.length, 0);
    const approval = await gateway.run([...args, "--yes"]); assert.equal(approval.code, 3, approval.err); assert.equal(approval.data.data.approvalId, "apr_taiji");
    assert.equal(approval.data.requestDigest, preview.data.requestDigest); assert.equal(gateway.calls[0].body.agentId, "agt_fixture");
    const status = await gateway.run(["taiji", "status", "--agent-id", "agt_fixture", "--limit", "1", "--offset", "0"]);
    assert.equal(status.code, 0, status.err); assert.equal(gateway.calls[1].path, "/taiji/capabilities?agentId=agt_fixture&limit=1&offset=0");
    const run = await gateway.run(["taiji", "run", "run_fixture", "--agent-id", "agt_fixture"]);
    assert.equal(run.code, 0, run.err); assert.equal(run.data.data.run.result.modelUsage.total, 0);
    gateway.variant("bad-taiji-artifact");
    const corrupt = await gateway.run(["taiji", "run", "run_fixture", "--agent-id", "agt_fixture"]);
    assert.equal(corrupt.code, 1); assert.equal(corrupt.data.code, "OPERATOR_RESPONSE_INVALID"); assert.equal(corrupt.data.retryAllowed, false);
    assert.equal(gateway.calls.length, 4);
    for (const invalidArgs of [["taiji", "status", "--yes"], ["taiji", "run", "../run", "--agent-id", "agt_fixture"],
      ["taiji", "evaluate", "--input", file, "--allow-real-provider"], ["taiji", "status", "--agent-id", "agt_fixture", "--limit", "101"]]) assert.throws(() => parseCliArgs(invalidArgs, {}));
  } finally {
    await gateway.close(); const target = await realpath(root);
    assert.equal(dirname(target), parent); assert.ok(basename(target).startsWith("uai-operator-taiji-")); await rm(root, { recursive: true, force: true });
  }
});

test("Taiji approval display rejects changed parameters and retains the complete reviewed data", () => {
  const sha = (value: string) => "sha256:" + createHash("sha256").update(value).digest("hex");
  const args = { facts: [{ key: "value", value: false }] };
  const params = Object.fromEntries(Object.entries({ authorityEpoch: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", lifecycleRevision: 2, operation: "execute", ownerHash: sha("owner"), revision: 1,
    capabilityId: "facts", profileId: "context-jsonl-v1", implementationHash: sha("implementation"), parameters: {}, candidateHash: sha("candidate"), activationEpoch: 2,
    runId: "run_fixture", arguments: args, argumentsHash: sha(JSON.stringify(args)) }).sort(([a], [b]) => a.localeCompare(b)));
  const review = { schemaVersion: 1, reviewable: true, effectType: "taiji:capability", policyHash: sha("policy"), taiji: {
    operation: "execute", params, paramsHash: sha(JSON.stringify(params)), effect: "Execute reviewed local data" } };
  assert.deepEqual(projectTaijiApprovalReview(review).taiji.params, params);
  assert.throws(() => projectTaijiApprovalReview({ ...review, taiji: { ...review.taiji, params: { ...params, revision: 2 } } }));
});
