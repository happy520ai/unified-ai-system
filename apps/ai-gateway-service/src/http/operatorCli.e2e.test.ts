// @test-isolation process
import { once } from "node:events";
import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { existsSync } from "node:fs";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it, vi } from "vitest";
import { runCli } from "../../../agent-console/src/cli-core.js";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "./httpServer.js";
import { createFakeProvider } from "../providers/fakeProvider.js";

async function listen(server: Server) { server.listen(0, "127.0.0.1"); await once(server, "listening"); return `http://127.0.0.1:${(server.address() as any).port}`; }
async function stop(server: Server) { await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }); }

it("uses the actual CLI, SDK and HTTP gateway for scoped knowledge, zero-call previews and approved pinned Forge execution", async () => {
  const temporaryRoot = await realpath(tmpdir()), root = await mkdtemp(join(temporaryRoot, "uai-operator-http-"));
  const siteRequests: string[] = [];
  const site = createServer((request, response) => {
    siteRequests.push(request.url!);
    if (request.url === "/catalog") {
      response.setHeader("content-type", "text/html");
      response.end(`<input id="query"><button id="search" type="button">Search</button><div id="results"></div><div id="result"></div>
        <script>document.querySelector('#search').onclick=async()=>{const q=document.querySelector('#query').value;await fetch('/search?q='+q);
          const b=document.createElement('button');b.id='details';b.textContent='Details';b.onclick=async()=>{const d=await fetch('/detail?id='+q).then(r=>r.json());
            const result=document.querySelector('#result');result.dataset.itemId=d.id;result.textContent=d.text;};document.querySelector('#results').replaceChildren(b);};</script>`);
    } else { response.setHeader("content-type", "application/json"); response.end(JSON.stringify({ id: "approved-item", text: "Approved detail" })); }
  });
  let server: any, app: any;
  const identity = { tenantId: "tenant-a", userId: "owner", role: "admin", permissions: ["*"] };
  const token = "operator-http-owner", otherToken = "operator-http-other";
  try {
    const origin = await listen(site);
    const chromium = createRequire(import.meta.resolve("@unified-ai-system/web-agent"))("playwright").chromium;
    const profile = { id: "catalog", tenantId: identity.tenantId, origin, startPath: "/catalog", searchPath: "/search", detailPath: "/detail",
      targets: { query: "query", search: "search", details: "details", result: "result" }, ...(existsSync(chromium.executablePath()) ? {} : { browserChannel: "chrome" }) };
    const env = { NODE_ENV: "test", AI_GATEWAY_PROVIDER_MODE: "fake", AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory", KNOWLEDGE_STORAGE_MODE: "memory", AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1",
      AI_GATEWAY_MODEL_LIBRARY_STATE_PATH: join(root, "models.json"), WORKFLOW_OUTPUT_DIR: join(root, "artifacts"),
      WORKFORCE_PLAN_STORE_PATH: join(root, "plans.json"), WORKFORCE_EXECUTION_DIR: join(root, "execution"), AI_GATEWAY_USAGE_LOG_DIR: join(root, "usage"),
      AI_GATEWAY_AGENT_EXEC_WORKING_DIRECTORY: root, AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
      AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"), AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "operator-fixture-signing-0123456789",
      AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(root, "clients.json"), AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(root, "clients.jsonl"), AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CONTROL_DIR: join(root, "client-control"),
      PME_ENTERPRISE_AUTH_ENABLED: "true", PME_AUTH_TOKEN: token, PME_AUTH_USER_ID: identity.userId, PME_AUTH_TENANT_ID: identity.tenantId, PME_AUTH_ROLE: "admin",
      PME_ENTERPRISE_PLATFORM_TENANT_ID: identity.tenantId, PME_ENTERPRISE_USER_STORE_PATH: join(root, "users.json"), PME_API_KEY_STORE_PATH: join(root, "keys.json"),
      PME_AUDIT_LOG_PATH: join(root, "audit.jsonl"), PME_AUDIT_CHAIN_PATH: join(root, "audit-chain.jsonl"),
      PME_ENTERPRISE_USERS_JSON: JSON.stringify([{ token: otherToken, userId: "other", tenantId: "tenant-b", role: "admin" }]),
      AI_GATEWAY_FORGE_WEB_PROFILES_JSON: JSON.stringify([profile]) };
    app = createGatewayApplication(env) as any;
    const provider = app.providerRegistry.get("local-fake-provider"), generate = provider.generate.bind(provider);
    let modelCalls = 0, mode = "polish", step = 0;
    vi.spyOn(provider, "generate").mockImplementation(async (request: any) => {
      modelCalls++; expect(request.target.providerId).toBe("local-fake-provider");
      expect(request.request.options.maxOutputTokens).toBeLessThanOrEqual(mode === "web" ? 512 : 4096);
      const result = await generate(request);
      let content = "export function improved() { return 'verified'; }";
      if (mode === "polish") expect(request.request.messages[1].content).toContain("Improve this draft");
      if (mode === "empty") content = "";
      if (mode === "web") {
        const snapshot = JSON.parse(request.request.messages[1].content).snapshot;
        const actions = [{ type: "fill", targetId: "query", value: "approved-item" }, { type: "click", targetId: "search" },
          { type: "click", targetId: "details" }, { type: "extractText", targetId: "result" }, { type: "done" }];
        content = JSON.stringify({ ...actions[step++], observationId: snapshot.observationId });
      }
      return { ...result, text: content, message: { role: "assistant", content } };
    });
    const alternate = createFakeProvider({ providerId: "alternate-fixture", modelId: "alternate-model", providerType: "fake", capabilities: ["chat"], enabled: true });
    const alternateCalls = vi.spyOn(alternate, "generate"); app.providerRegistry.register(alternate); app.providerRegistry.enableProvider("alternate-fixture");
    const weighted = { apply: vi.fn(() => ({ overrideProviderId: "alternate-fixture", routeName: "fixture" })), shouldShadow: vi.fn(() => ({ providerId: "alternate-fixture", percent: 100, routeName: "fixture" })) };
    app.gatewayService.weightedTrafficPolicy = weighted;
    server = createGatewayHttpServer(app); const base = await listen(server);
    async function cli(args: string[], key = token, json = true) {
      let out = "", err = "";
      const code = await runCli([...args, "--url", base, ...(json ? ["--json"] : [])], { env: { AGENT_CONSOLE_ADMIN_KEY: key },
        stdout: { isTTY: false, write: (value: string) => { out += value; } }, stderr: { write: (value: string) => { err += value; } } });
      return { code, out, err, data: json ? JSON.parse(out || err) : null };
    }
    const inputFile = join(root, "documents.json");
    await writeFile(inputFile, JSON.stringify({ sourceId: "operator-source", sourceTitle: "Operator source", documents: [{ documentId: "unique", title: "Marker", content: "unique-operator-058-marker 中文内容" }] }));
    expect((await cli(["knowledge", "load", "--input", inputFile])).data.status).toBe("preview");
    const before = await cli(["knowledge", "sources"]); expect(before.data.data.sources.some((source: any) => source.sourceId === "operator-source")).toBe(false);
    const loaded = await cli(["knowledge", "load", "--input", inputFile, "--yes"]);
    expect(loaded.code, loaded.err).toBe(0); expect(loaded.data.data.loadedCount).toBe(1);
    const retrieved = await cli(["knowledge", "retrieve", "unique-operator-058-marker", "--source-id", "operator-source"]);
    expect(retrieved.code, retrieved.err).toBe(0); expect(retrieved.data.data.chunks[0].document.documentId).toBe("unique");
    const other = await cli(["knowledge", "retrieve", "unique-operator-058-marker", "--source-id", "operator-source"], otherToken);
    expect(other.data.data.chunks).toEqual([]);
    expect((await cli(["routing", "preview", "查阅当前状态"])).data.data.externalApiCalled).toBe(false);
    expect((await cli(["routing", "preview", "Summarize local evidence", "--mode", "quality-cost"])).data.data.paidApiCallCount).toBe(0);
    expect(modelCalls).toBe(0); expect(alternateCalls).not.toHaveBeenCalled();

    const childEnv: Record<string, string> = { AGENT_CONSOLE_ADMIN_KEY: token };
    for (const key of ["PATH", "SystemRoot", "WINDIR", "TEMP", "TMP", "ComSpec", "PATHEXT"]) if (process.env[key]) childEnv[key] = process.env[key]!;
    const entrypoint = fileURLToPath(new URL("../../../agent-console/src/cli.js", import.meta.url));
    const child = spawn(process.execPath, [entrypoint, "knowledge", "health", "--json", "--url", base], { cwd: root, env: childEnv, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let childOut = "", childErr = ""; child.stdout.on("data", chunk => { childOut += chunk; }); child.stderr.on("data", chunk => { childErr += chunk; });
    const timer = setTimeout(() => child.kill(), 10000); let exit;
    try { [exit] = await once(child, "exit"); } finally { clearTimeout(timer); if (child.exitCode === null) child.kill(); }
    expect(exit, childErr).toBe(0); expect(JSON.parse(childOut).data.documentCount).toBeGreaterThan(0);

    expect((await cli(["forge", "polish", "Improve this draft", "--yes", "--passes", "1"])).code).toBe(0);
    expect(modelCalls).toBe(1); expect(weighted.apply).not.toHaveBeenCalled(); expect(weighted.shouldShadow).not.toHaveBeenCalled(); expect(alternateCalls).not.toHaveBeenCalled();
    expect((await cli(["forge", "polish", "draft", "--yes", "--passes", "1", "--provider-id", "alternate-fixture", "--model-id", "alternate-model"])).code).toBe(2);
    const alternateResult = await cli(["forge", "polish", "draft", "--yes", "--passes", "1", "--provider-id", "alternate-fixture", "--model-id", "alternate-model", "--allow-real-provider"]);
    expect(alternateResult.code, alternateResult.err).toBe(0); expect(alternateCalls).toHaveBeenCalledTimes(1); expect(weighted.apply).not.toHaveBeenCalled();
    for (const args of [["forge", "memory", "operator-memo-058", "--yes"], ["forge", "recall", "operator-memo-058"],
      ["forge", "quality", "export const value = 1"], ["forge", "taiji", "Build a draft catalog reader"], ["forge", "workforce", "Draft a local review plan"]]) {
      const result = await cli(args);
      if (args[1] === "quality") expect(result.code, result.err || result.out).toBe(result.data.data.evaluation.passed ? 0 : 1);
      else expect(result.code, result.err || result.out).toBe(0);
      if (args[1] === "recall") expect(result.data.data.working.entries[0].content).toBe("operator-memo-058");
    }
    expect(modelCalls).toBe(1); expect(alternateCalls).toHaveBeenCalledTimes(1);

    const service = app.agentGovernance.service, tools = ["forge_orchestrate", "browser_navigate", "browser_observe", "browser_interact"];
    await service.createPolicyVersion({ policyKey: "execution-family", version: 3, policyType: "family", scopeKey: "execution", content: {
      capabilityCeiling: tools, toolRules: { ...Object.fromEntries(tools.map(tool => [tool, "allow"])), forge_orchestrate: "require_approval" },
      limits: { maxSteps: 50, maxToolCalls: 80, maxRuntimeSeconds: 120 }, permissions: { canCreateChildren: true, canWrite: true, canSendExternalMessage: true, canExecuteCode: false } } }, identity);
    await service.activatePolicyVersion("execution-family", 3, identity);
    const agent = await service.generateAgent({ name: "operator-web", task: "Query a local catalog", requestedTools: tools, ttlSeconds: 3600,
      proposedTraits: ["write_capable", "external_communication", "subagent_creator"], proposedRiskLevel: "high" }, identity);
    const operationFile = join(root, "forge-request.json");
    await writeFile(operationFile, JSON.stringify({ agentId: agent.agentId, goal: "Read approved-item details", options: { budget: { maxTokens: 32000 },
      webTask: { profileId: "catalog", itemId: "approved-item", expectedText: "Approved detail" } } }));
    const pending = await cli(["forge", "orchestrate", "--input", operationFile, "--yes"]);
    expect(pending.code, pending.err || pending.out).toBe(3); expect(siteRequests).toEqual([]);
    const approvals = await cli(["agents", "approvals", "--agent-id", agent.agentId]);
    expect(approvals.code, approvals.err).toBe(0);
    const review = approvals.data.data.find((item: any) => item.id === pending.data.data.approvalId).review;
    expect(review.forge.options.budget.maxTokens).toBe(32000); expect(review.forge.options.modelSelection.providerId).toBe("local-fake-provider");
    expect(review.forge.options.webTask.profile.origin).toBe(origin);
    const approved = await cli(["agents", "approve", "--approval-id", pending.data.data.approvalId, "--yes"]);
    expect(approved.code, approved.err).toBe(0);
    const originalOperation = { agentId: agent.agentId, goal: "Read approved-item details", options: { budget: { maxTokens: 32000 },
      webTask: { profileId: "catalog", itemId: "approved-item", expectedText: "Approved detail" } } };
    await writeFile(operationFile, JSON.stringify({ ...originalOperation, options: { ...originalOperation.options,
      modelSelection: { providerId: "alternate-fixture", modelId: "alternate-model" }, maxOutputTokens: 2048 } }));
    const changed = await cli(["forge", "orchestrate", "--input", operationFile, "--yes", "--allow-real-provider"]);
    expect(changed.code, changed.err || changed.out).toBe(3); expect(changed.data.data.approvalId).not.toBe(pending.data.data.approvalId);
    expect(modelCalls).toBe(1); expect(siteRequests).toEqual([]);
    await writeFile(operationFile, JSON.stringify(originalOperation));
    mode = "web";
    const run = await cli(["forge", "orchestrate", "--input", operationFile, "--yes"]);
    expect(run.code, run.err || run.out).toBe(0); expect(run.data.data.result.web.goalVerified).toBe(true); expect(run.data.data.result.web.browserClosed).toBe(true);
    expect(modelCalls).toBe(6); expect(alternateCalls).toHaveBeenCalledTimes(1); expect(weighted.apply).not.toHaveBeenCalled(); expect(weighted.shouldShadow).not.toHaveBeenCalled();
    expect(siteRequests).toEqual(["/catalog", "/search?q=approved-item", "/detail?id=approved-item"]);
    const runs = await cli(["forge", "runs"]); expect(runs.code, runs.err).toBe(0); expect(runs.data.data.runs[0].runId).toBe(run.data.data.runId);
    mode = "empty";
    const failed = await cli(["forge", "polish", "empty fixture", "--yes", "--passes", "3"]);
    expect(failed.code).toBe(1); expect(failed.data.code).toBe("FORGE_LLM_EMPTY_RESPONSE"); expect(failed.data.retryAllowed).toBe(false);
    expect(modelCalls).toBe(7); expect(alternateCalls).toHaveBeenCalledTimes(1);
  } finally {
    if (server) { await stop(server); await server.shutdownResources(); }
    if (site.listening) await stop(site);
    const owned = await realpath(root); expect(dirname(owned)).toBe(temporaryRoot); expect(basename(owned).startsWith("uai-operator-http-")).toBe(true);
    await rm(owned, { recursive: true, force: true }); vi.restoreAllMocks();
  }
}, 40000);
