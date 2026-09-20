// @test-isolation process
import { once } from "node:events";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { expect, it, vi } from "vitest";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "./httpServer.js";
import { runCli } from "../../../agent-console/src/cli-core.js";

it("governs actual Taiji evaluation, activation, execution, result reading and revocation through HTTP", async () => {
  const parent = await realpath(tmpdir()), root = await mkdtemp(join(parent, "uai-taiji-http-"));
  const identity = { tenantId: "tenant-a", userId: "owner", role: "admin", permissions: ["*"] };
  const token = "taiji-http-owned-fixture", otherToken = "taiji-http-other-fixture";
  let server: any, app: any;
  let releaseHeld: (() => void) | undefined;
  try {
    const env = { NODE_ENV: "test", AI_GATEWAY_PROVIDER_MODE: "fake", AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory", KNOWLEDGE_STORAGE_MODE: "memory", AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1",
      AI_GATEWAY_MODEL_LIBRARY_STATE_PATH: join(root, "models.json"), WORKFLOW_OUTPUT_DIR: join(root, "artifacts"),
      WORKFORCE_PLAN_STORE_PATH: join(root, "plans.json"), WORKFORCE_EXECUTION_DIR: join(root, "execution"), AI_GATEWAY_USAGE_LOG_DIR: join(root, "usage"),
      AI_GATEWAY_AGENT_EXEC_WORKING_DIRECTORY: root, AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true", TAIJI_BEIDOU_AUTO_RUNTIME_ENABLED: "true",
      AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"), AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "taiji-http-fixture-signing-0123456789",
      AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(root, "clients.json"), AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(root, "clients.jsonl"), AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CONTROL_DIR: join(root, "client-control"),
      PME_ENTERPRISE_AUTH_ENABLED: "true", PME_AUTH_TOKEN: token, PME_AUTH_USER_ID: identity.userId, PME_AUTH_TENANT_ID: identity.tenantId, PME_AUTH_ROLE: "admin",
      PME_ENTERPRISE_PLATFORM_TENANT_ID: identity.tenantId, PME_ENTERPRISE_USER_STORE_PATH: join(root, "users.json"), PME_API_KEY_STORE_PATH: join(root, "keys.json"),
      PME_AUDIT_LOG_PATH: join(root, "audit.jsonl"), PME_AUDIT_CHAIN_PATH: join(root, "audit-chain.jsonl"),
      PME_ENTERPRISE_USERS_JSON: JSON.stringify([{ token: otherToken, userId: "other", tenantId: "tenant-b", role: "admin" }]) };
    app = createGatewayApplication(env);
    const provider = vi.spyOn(app.providerRegistry.get("local-fake-provider"), "generate");
    const governance = app.agentGovernance.service, tools = ["taiji_capability", "taiji_inspect"];
    await governance.createPolicyVersion({ policyKey: "execution-family", version: 3, policyType: "family", scopeKey: "execution", content: {
      capabilityCeiling: tools, toolRules: { taiji_capability: "require_approval", taiji_inspect: "allow" },
      limits: { maxSteps: 50, maxToolCalls: 80, maxRuntimeSeconds: 120, maxRecords: 100 },
      permissions: { canCreateChildren: true, canWrite: true, canSendExternalMessage: false, canExecuteCode: false } } }, identity);
    await governance.activatePolicyVersion("execution-family", 3, identity);
    const agent = await governance.generateAgent({ name: "capability-operator", task: "Evaluate and execute fixed local data transformations",
      requestedTools: tools, ttlSeconds: 3600, proposedTraits: ["write_capable"], proposedRiskLevel: "medium" }, identity);
    expect(agent.status).not.toBe("blocked");
    server = createGatewayHttpServer(app); server.listen(0, "127.0.0.1"); await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    async function cli(args: string[]) {
      let out = "", err = "";
      const code = await runCli([...args, "--url", base, "--json"], { env: { AGENT_CONSOLE_ADMIN_KEY: token },
        stdout: { isTTY: false, write: (value: string) => { out += value; } }, stderr: { write: (value: string) => { err += value; } } });
      return { code, data: JSON.parse(out || err), out, err };
    }
    async function api(path: string, body?: Record<string, unknown>, auth = token) {
      const response = await fetch(base + path, { method: body ? "POST" : "GET", headers: { authorization: `Bearer ${auth}`, "content-type": "application/json" },
        ...(body ? { body: JSON.stringify({ ...body, agentId: agent.agentId }) } : {}) });
      return { status: response.status, body: await response.json() as any };
    }
    const query = `/taiji/capabilities?agentId=${agent.agentId}`;
    const initial = await api(query); expect(initial.status, JSON.stringify(initial.body)).toBe(200);
    expect(initial.body.data.profiles).toHaveLength(3); expect(initial.body.data.capabilities).toEqual([]);
    const evaluate = { capabilityId: "facts", expectedLifecycleRevision: 0, profileId: "context-jsonl-v1", request: "Preserve all supplied context facts and references" };
    const inputFile = join(root, "taiji-operation.json"); await writeFile(inputFile, JSON.stringify(evaluate));
    const preview = await cli(["taiji", "evaluate", "--agent-id", agent.agentId, "--input", inputFile]);
    expect(preview.code, preview.err).toBe(0); expect(preview.data.status).toBe("preview");
    const pendingEvaluation = await api("/taiji/capabilities/evaluate", evaluate);
    expect(pendingEvaluation.status, JSON.stringify(pendingEvaluation.body)).toBe(202);
    expect((await api(query)).body.data.capabilities).toHaveLength(0);
    const cliPending = await cli(["taiji", "evaluate", "--agent-id", agent.agentId, "--input", inputFile, "--yes"]);
    expect(cliPending.code, cliPending.err).toBe(3); expect(cliPending.data.data.approvalId).toBe(pendingEvaluation.body.data.approvalId);
    const approvals = await cli(["agents", "approvals", "--agent-id", agent.agentId]);
    expect(approvals.code, approvals.err).toBe(0);
    const reviewed = approvals.data.data.find((item: any) => item.id === pendingEvaluation.body.data.approvalId).review.taiji;
    expect(reviewed.params.request).toBe(evaluate.request); expect(reviewed.params.authorityEpoch).toMatch(/^[a-f0-9-]{36}$/);
    expect((await cli(["agents", "approve", "--approval-id", pendingEvaluation.body.data.approvalId, "--yes"])).code).toBe(0);
    const evaluated = await api("/taiji/capabilities/evaluate", evaluate);
    expect(evaluated.status, JSON.stringify(evaluated.body)).toBe(200); expect(evaluated.body.data.status).toBe("evaluated");
    expect(evaluated.body.data.capability.versions[0].evaluation.tests).toHaveLength(3);
    expect(evaluated.body.data.capability.versions[0].evaluation.tests.every((entry: any) => entry.actualExecution && entry.workerClosed)).toBe(true);
    expect(evaluated.body.data.capability.activation).toBeNull();
    const activation = { capabilityId: "facts", expectedLifecycleRevision: 1, revision: 1, limits: { maxRequests: 3, maxRuntimeMs: 30000, ttlSeconds: 300 } };
    const pendingActivation = await api("/taiji/capabilities/activate", activation);
    expect(pendingActivation.status, JSON.stringify(pendingActivation.body)).toBe(202);
    await governance.decideApproval(pendingActivation.body.data.approvalId, "approve", identity);
    const changed = await api("/taiji/capabilities/activate", { ...activation, limits: { ...activation.limits, maxRequests: 2 } });
    expect(changed.status).toBe(202); expect(changed.body.data.approvalId).not.toBe(pendingActivation.body.data.approvalId);
    expect((await api(query)).body.data.capabilities[0].activation).toBeNull();
    const activated = await api("/taiji/capabilities/activate", activation);
    expect(activated.status, JSON.stringify(activated.body)).toBe(200); expect(activated.body.data.status).toBe("active");
    const request = { capabilityId: "facts", expectedLifecycleRevision: 2, revision: 1, runId: "actual-run",
      arguments: { facts: [{ key: "approved", value: false }, { key: "task", value: "保留事实", reference: "doc:1" }] } };
    const pendingRun = await api("/taiji/capabilities/execute", request);
    expect(pendingRun.status, JSON.stringify(pendingRun.body)).toBe(202);
    await governance.decideApproval(pendingRun.body.data.approvalId, "approve", identity);
    const run = await api("/taiji/capabilities/execute", request);
    expect(run.status, JSON.stringify(run.body)).toBe(200); expect(run.body.data.status).toBe("passed");
    expect(run.body.data.records).toEqual(request.arguments.facts);
    expect(run.body.data.run.result.workerClosed).toBe(true);
    expect(run.body.data.run.result.modelUsage).toMatchObject({ unit: "tokens", total: 0, requests: 0, source: "owned-worker-lifecycle" });
    const replay = await api("/taiji/capabilities/execute", request);
    expect(replay.body.data.status).toBe("replayed"); expect(replay.body.data.executionRepeated).toBe(false);
    const inspect = await api(`/taiji/capabilities/runs/actual-run?agentId=${agent.agentId}`);
    expect(inspect.status, JSON.stringify(inspect.body)).toBe(200); expect(inspect.body.data.run.result.artifact).toEqual(run.body.data.run.result.artifact);
    const cliRun = await cli(["taiji", "run", "actual-run", "--agent-id", agent.agentId]);
    expect(cliRun.code, cliRun.err).toBe(0); expect(cliRun.data.data.run.result.artifact).toEqual(run.body.data.run.result.artifact);
    const crossTenant = await api(`/taiji/capabilities/runs/actual-run?agentId=${agent.agentId}`, undefined, otherToken);
    expect(crossTenant.status).toBeGreaterThanOrEqual(400); expect(JSON.stringify(crossTenant.body)).not.toContain("保留事实");
    const metadata = await api(query); expect(metadata.body.data.runs[0].result.artifact.content).toBeUndefined();
    expect(metadata.body.data.capabilities[0].totalRequests).toBe(1);
    const actualExecute = app.taijiCapabilityService.execute.bind(app.taijiCapabilityService);
    const lost = { ...request, runId: "lost-reply" };
    const pendingLost = await api("/taiji/capabilities/execute", lost);
    expect(pendingLost.status).toBe(202); await governance.decideApproval(pendingLost.body.data.approvalId, "approve", identity);
    const replyFault = vi.spyOn(app.taijiCapabilityService, "execute").mockImplementationOnce(async (...args: any[]) => {
      await actualExecute(...args); throw Object.assign(new Error("Owned post-commit reply fault"), { code: "TAIJI_TEST_REPLY_LOST" });
    });
    await writeFile(inputFile, JSON.stringify(lost));
    const unknown = await cli(["taiji", "execute", "--agent-id", agent.agentId, "--input", inputFile, "--yes"]);
    replyFault.mockRestore();
    expect(unknown.code).toBe(1); expect(unknown.data.status).toBe("unknown-reconcile-required"); expect(unknown.data.runId).toBe("lost-reply");
    const recovered = await cli(["taiji", "run", "lost-reply", "--agent-id", agent.agentId]);
    expect(recovered.code, recovered.err).toBe(0); expect(recovered.data.data.run.status).toBe("passed");
    expect((await api(query)).body.data.capabilities[0].totalRequests).toBe(2);
    const currentCapability = async (id: string) => (await api(query)).body.data.capabilities.find((item: any) => item.id === id);
    async function confirm(operation: string, body: Record<string, unknown>, expectedStatus: string) {
      await writeFile(inputFile, JSON.stringify(body));
      const args = ["taiji", operation, "--agent-id", agent.agentId, "--input", inputFile, "--yes"];
      const pending = await cli(args); expect(pending.code, pending.err || pending.out).toBe(3);
      if (operation === "repair") {
        const reviews = await cli(["agents", "approvals", "--agent-id", agent.agentId]); expect(reviews.code, reviews.err).toBe(0);
        const review = reviews.data.data.find((item: any) => item.id === pending.data.data.approvalId).review.taiji;
        expect(review.params.regression.arguments).toEqual(body.sourceArguments);
        expect(review.params.parameters.additionalRiskKeywords.deploy_release).toEqual(["ship production"]);
      }
      await governance.decideApproval(pending.data.data.approvalId, "approve", identity);
      const done = await cli(args); expect(done.code, done.err || done.out).toBe(expectedStatus === "failed" ? 1 : 0);
      expect(done.data.data.status).toBe(expectedStatus); return done.data.data;
    }
    const riskArgs = { text: "ship production", expectedSignals: ["deploy_release"] };
    await confirm("evaluate", { capabilityId: "risk", expectedLifecycleRevision: 0, profileId: "risk-classification-v1",
      request: "Risk classification with reviewable shipping language" }, "evaluated");
    await confirm("activate", { capabilityId: "risk", expectedLifecycleRevision: 1, revision: 1 }, "active");
    for (const runId of ["risk-fail-one", "risk-fail-two"]) {
      const current = await currentCapability("risk");
      const failed = await confirm("execute", { capabilityId: "risk", expectedLifecycleRevision: current.lifecycleRevision, revision: 1,
        runId, arguments: riskArgs }, "failed");
      expect(failed.run.result.blockedReason).toBe("TAIJI_VERIFICATION_FAILED");
      await confirm("reweight", { capabilityId: "risk", expectedLifecycleRevision: current.lifecycleRevision, revision: 1, sourceRunId: runId }, "reweighted");
      if (runId === "risk-fail-one") {
        const premature = await api("/taiji/capabilities/prune", { capabilityId: "risk", expectedLifecycleRevision: (await currentCapability("risk")).lifecycleRevision,
          revision: 1, sourceRunId: runId }); expect(premature.status).toBe(409);
      }
    }
    await confirm("prune", { capabilityId: "risk", expectedLifecycleRevision: (await currentCapability("risk")).lifecycleRevision, revision: 1, sourceRunId: "risk-fail-two" }, "pruned");
    const repair = { capabilityId: "risk", expectedLifecycleRevision: (await currentCapability("risk")).lifecycleRevision, revision: 1,
      sourceRunId: "risk-fail-two", sourceArguments: riskArgs, addRiskKeywords: { deploy_release: ["ship production"] } };
    const changedRegression = await api("/taiji/capabilities/repair", { ...repair, sourceArguments: { ...riskArgs, expectedSignals: [] } });
    expect(changedRegression.status).toBe(409);
    const repaired = await confirm("repair", repair, "evaluated");
    expect(repaired.capability.versions[1].evaluation.tests).toHaveLength(11);
    await confirm("activate", { capabilityId: "risk", expectedLifecycleRevision: repaired.capability.lifecycleRevision, revision: 2 }, "active");
    const selected = await confirm("execute", { selection: { profileId: "risk-classification-v1" }, runId: "risk-repaired", arguments: riskArgs }, "passed");
    expect(selected.run.capabilityId).toBe("risk"); expect(selected.run.revision).toBe(2);
    expect(JSON.parse(selected.run.result.artifact.content).signals).toEqual(["deploy_release"]);
    const firstFailure = await api(`/taiji/capabilities/runs/risk-fail-two?agentId=${agent.agentId}`);
    expect(firstFailure.body.data.run.status).toBe("failed"); expect(firstFailure.body.data.run.argumentsHash).toBe(selected.run.argumentsHash);
    expect((await currentCapability("risk")).versions[0].status).toBe("revoked");
    const cancelling = { ...request, runId: "cancelled-run" };
    const pendingCancel = await api("/taiji/capabilities/execute", cancelling);
    expect(pendingCancel.status).toBe(202); await governance.decideApproval(pendingCancel.body.data.approvalId, "approve", identity);
    let release!: () => void, observed!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; releaseHeld = resolve; }); const reached = new Promise<void>(resolve => { observed = resolve; });
    const pause = vi.spyOn(app.taijiCapabilityService, "execute").mockImplementationOnce(async (prepared: any, authority: any) => {
      let checks = 0;
      return actualExecute(prepared, { ...authority, assertActive: async () => {
        if (++checks === 3) {
          authority.signal.addEventListener("abort", release, { once: true });
          observed(); if (authority.signal.aborted) release();
          try { await held; } finally { authority.signal.removeEventListener("abort", release); }
        }
        await authority.assertActive();
      } });
    });
    const live = api("/taiji/capabilities/execute", cancelling); await reached;
    const revoke = await api("/taiji/capabilities/revoke", { capabilityId: "facts", expectedLifecycleRevision: 2, revision: 1 });
    expect(revoke.status, JSON.stringify(revoke.body)).toBe(200); expect(revoke.body.data.status).toBe("revoked");
    const staleApproval = await api("/taiji/capabilities/activate", { ...activation, limits: { ...activation.limits, maxRequests: 2 } });
    expect(staleApproval.status).toBe(409);
    const revoked = await api("/taiji/capabilities/execute", { ...request, runId: "after-revoke", expectedLifecycleRevision: 3 });
    expect(revoked.status).toBe(409);
    await governance.revokeAgent(agent.agentId, { reason: "owned-fixture-completed", cascade: true }, identity);
    release(); const cancelledResponse = await live; pause.mockRestore();
    expect(cancelledResponse.status).toBe(503); expect(cancelledResponse.body.error.details.outcomeUnknown).toBe(true);
    const cancelledReceipt = await api(`/taiji/capabilities/runs/cancelled-run?agentId=${agent.agentId}`);
    expect(cancelledReceipt.status).toBe(200); expect(cancelledReceipt.body.data.run.status).toBe("cancelled");
    expect(cancelledReceipt.body.data.run.result.workerClosed).toBe(true); expect(cancelledReceipt.body.data.run.result.artifact).toBeNull();
    const recordedAfterAgentRevoke = await cli(["taiji", "run", "actual-run", "--agent-id", agent.agentId]);
    expect(recordedAfterAgentRevoke.code, recordedAfterAgentRevoke.err).toBe(0);
    expect(recordedAfterAgentRevoke.data.data.run.result.artifact).toEqual(run.body.data.run.result.artifact);
    expect(provider).not.toHaveBeenCalled();
  } finally {
    releaseHeld?.();
    if (server) { await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }); await server.shutdownResources(); }
    else await app?.taijiCapabilityService?.close();
    const target = await realpath(root);
    if (dirname(target) !== parent || !basename(target).startsWith("uai-taiji-http-") || resolve(root) !== target) throw new Error("Unsafe test cleanup path");
    await rm(root, { recursive: true, force: true });
  }
}, 600_000);
