// @test-isolation process
import { once } from "node:events";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtemp, readFile, realpath, rm, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "./httpServer.js";
import { runCli } from "../../../agent-console/src/cli-core.js";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanups.splice(0).reverse()) await close(); vi.restoreAllMocks(); });

async function fixture(requireApproval = true) {
  const parent = await realpath(tmpdir()), root = await mkdtemp(join(parent, "uai-media-http-"));
  let app: any, server: any, stopped = false, cleaned = false;
  const stop = async () => { if (stopped) return; stopped = true;
    if (server) { await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }); await server.shutdownResources(); }
    else await app?.close?.(); };
  const close = async () => { if (cleaned) return; try { await stop(); } finally {
    const target = await realpath(root); expect(dirname(target)).toBe(parent); expect(basename(target).startsWith("uai-media-http-")).toBe(true);
    await rm(target, { recursive: true, force: false }); cleaned = true; vi.restoreAllMocks();
  } };
  cleanups.push(close);
  const identity = { tenantId: "tenant-a", userId: "owner", role: "admin", permissions: ["*"] };
  const token = "media-http-owner-fixture", otherToken = "media-http-operator-fixture";
  const profile = { id: "demo-speech", tenantId: identity.tenantId, providerId: "local-fake-provider", modelId: "local-fake-model",
    voice: "alloy", format: "wav-pcm16", maxTextBytes: 4096, maxAudioBytes: 65536, maxDurationMs: 1000, timeoutMs: 10000 };
  const env = { NODE_ENV: "test", AI_GATEWAY_PROVIDER_MODE: "fake", AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory", KNOWLEDGE_STORAGE_MODE: "memory", AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1",
    AI_GATEWAY_MODEL_LIBRARY_STATE_PATH: join(root, "models.json"), WORKFLOW_OUTPUT_DIR: join(root, "artifacts"),
    WORKFORCE_PLAN_STORE_PATH: join(root, "plans.json"), WORKFORCE_EXECUTION_DIR: join(root, "execution"), AI_GATEWAY_USAGE_LOG_DIR: join(root, "usage"),
    AI_GATEWAY_AGENT_EXEC_WORKING_DIRECTORY: root, AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
    AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"), AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "media-fixture-signing-012345678901",
    AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(root, "clients.json"), AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(root, "clients.jsonl"),
    AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CONTROL_DIR: join(root, "client-control"), PME_ENTERPRISE_AUTH_ENABLED: "true",
    PME_AUTH_TOKEN: token, PME_AUTH_USER_ID: identity.userId, PME_AUTH_TENANT_ID: identity.tenantId, PME_AUTH_ROLE: "admin",
    PME_ENTERPRISE_PLATFORM_TENANT_ID: identity.tenantId, PME_ENTERPRISE_USER_STORE_PATH: join(root, "users.json"), PME_API_KEY_STORE_PATH: join(root, "keys.json"),
    PME_AUDIT_LOG_PATH: join(root, "audit.jsonl"), PME_AUDIT_CHAIN_PATH: join(root, "audit-chain.jsonl"),
    PME_ENTERPRISE_USERS_JSON: JSON.stringify([{ token: otherToken, userId: "other", tenantId: identity.tenantId, role: "operator" }]),
    AI_GATEWAY_FORGE_MEDIA_PROFILES_JSON: JSON.stringify([profile]) };
  app = createGatewayApplication(env) as any; server = createGatewayHttpServer(app) as any;
  const operations = vi.spyOn(app.gatewayService, "executeProviderOperation");
  const modelCalls = vi.spyOn(app.providerRegistry.get("local-fake-provider"), "generate");
  server.listen(0, "127.0.0.1"); await once(server, "listening"); const base = `http://127.0.0.1:${server.address().port}`;
  const service = app.agentGovernance.service, tools = ["forge_orchestrate", "media_synthesize_speech"];
  await service.createPolicyVersion({ policyKey: "execution-family", version: 3, policyType: "family", scopeKey: "execution", content: {
    capabilityCeiling: tools, toolRules: { forge_orchestrate: requireApproval ? "require_approval" : "allow", media_synthesize_speech: "allow" },
    limits: { maxSteps: 20, maxToolCalls: 40, maxRuntimeSeconds: 60, maxRecords: 5 },
    permissions: { canCreateChildren: true, canWrite: true, canSendExternalMessage: true, canExecuteCode: false } } }, identity);
  await service.activatePolicyVersion("execution-family", 3, identity);
  const agent = await service.generateAgent({ name: "approved-speech", task: "Deliver one approved speech artifact", requestedTools: tools, ttlSeconds: 3600,
    proposedTraits: ["write_capable", "external_communication", "subagent_creator"], proposedRiskLevel: "high" }, identity);
  async function cli(args: string[], key = token, failDisplay = false, json = true) {
    let out = "", err = "";
    const code = await runCli([...args, "--url", base, ...(json ? ["--json"] : [])], { env: { AGENT_CONSOLE_ADMIN_KEY: key },
      stdout: { isTTY: false, write: (v: string) => { if (failDisplay) throw Error("fixture display unavailable"); out += v; } }, stderr: { write: (v: string) => { err += v; } } });
    return { code, out, err, data: json ? JSON.parse(out || err) : null };
  }
  async function childCli(args: string[]) {
    const childEnv: Record<string, string> = { AGENT_CONSOLE_ADMIN_KEY: token };
    for (const key of ["PATH", "SystemRoot", "WINDIR", "TEMP", "TMP", "ComSpec", "PATHEXT"]) if (process.env[key]) childEnv[key] = process.env[key]!;
    const entry = fileURLToPath(new URL("../../../agent-console/src/cli.js", import.meta.url));
    const child = spawn(process.execPath, [entry, ...args, "--url", base, "--json"], {
      cwd: root, env: childEnv, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "", err = "";
    child.stdout.on("data", chunk => { out += chunk; if (Buffer.byteLength(out) > 200000) child.kill(); });
    child.stderr.on("data", chunk => { err += chunk; if (Buffer.byteLength(err) > 200000) child.kill(); });
    const timer = setTimeout(() => child.kill(), 15000);
    let code;
    try { [code] = await once(child, "close"); } finally { clearTimeout(timer); }
    return { code, out, err, data: code === 0 ? JSON.parse(out) : null };
  }
  const text = "  你好，网关。\n", file = join(root, "speech-request.json"), output = join(root, "欢迎.wav");
  const body = { agentId: agent.agentId, goal: "Deliver the exact reviewed speech text", options: {
    modelSelection: { providerId: profile.providerId, modelId: profile.modelId }, mediaTask: { profileId: profile.id, text } } };
  await writeFile(file, JSON.stringify(body));
  const args = ["forge", "orchestrate", "--input", file, "--audio-output", output];
  return { app, operations, modelCalls, profile, identity, agent, cli, childCli, text, file, output, body, args, otherToken, stop, close };
}

it("runs the actual CLI/SDK/HTTP approval and one private Forge speech operation, retaining the saved WAV after shutdown", async () => {
  const f = await fixture();
  try {
    const preview = await f.cli(f.args); expect(preview.code, preview.err).toBe(0); expect(preview.data.status).toBe("preview");
    expect(f.operations).not.toHaveBeenCalled(); await expect(access(f.output)).rejects.toThrow();
    const pending = await f.cli([...f.args, "--yes"]); expect(pending.code, pending.err || pending.out).toBe(3);
    expect(f.operations).not.toHaveBeenCalled();
    const approvals = await f.cli(["agents", "approvals", "--agent-id", f.agent.agentId]); expect(approvals.code, approvals.err).toBe(0);
    const review = approvals.data.data.find((item: any) => item.id === pending.data.data.approvalId).review.forge.options.mediaTask;
    expect(review.text).toBe(f.text); expect(review.textBytes).toBe(Buffer.byteLength(f.text));
    expect(review.profile).toEqual(f.profile); expect(review.textSha256).toBe(createHash("sha256").update(f.text).digest("hex"));
    expect((await f.cli(["agents", "approve", "--approval-id", pending.data.data.approvalId, "--yes"])).code).toBe(0);
    await writeFile(f.file, JSON.stringify({ ...f.body, options: { ...f.body.options, mediaTask: { ...f.body.options.mediaTask, text: f.text + "changed" } } }));
    const changed = await f.cli([...f.args, "--yes"]); expect(changed.code, changed.err).toBe(3);
    expect(changed.data.data.approvalId).not.toBe(pending.data.data.approvalId); expect(f.operations).not.toHaveBeenCalled();
    await writeFile(f.file, JSON.stringify(f.body));
    const denied = await f.cli([...f.args, "--yes"], f.otherToken);
    expect(denied.code).toBe(1); expect(denied.data.code).toBe("AGENT_EXECUTION_OWNER_REQUIRED"); expect(f.operations).not.toHaveBeenCalled();
    const saved = await f.childCli([...f.args, "--yes"]); expect(saved.code, saved.err || saved.out).toBe(0);
    expect(saved.data.data.result.completedTasks).toBe(1); expect(saved.data.data.result.failedTasks).toBe(0);
    expect(saved.data.data.result.media.usage).toEqual({ source: "synthetic", reported: null, inputCharacters: Array.from(f.text).length, providerCalls: 1 });
    expect(saved.data.data.result.media.synthetic).toBe(true); expect(saved.out).not.toContain("audioBase64");
    const bytes = await readFile(f.output), checksum = createHash("sha256").update(bytes).digest("hex");
    expect(saved.data.data.audioOutput).toMatchObject({ status: "saved", path: f.output, bytes: bytes.length, sha256: checksum });
    expect(saved.data.data.result.media.artifacts[0].sha256).toBe(checksum); expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
    expect(f.operations).toHaveBeenCalledOnce(); expect(f.modelCalls).not.toHaveBeenCalled();
    expect(f.operations.mock.calls[0]![0]).toMatchObject({ operationType: "text_to_speech", providerId: "local-fake-provider", providerType: "fake", modelId: "local-fake-model" });
    const repeat = await f.cli([...f.args, "--yes"]); expect(repeat.code).toBe(1); expect(f.operations).toHaveBeenCalledOnce();
    expect(await readFile(f.output)).toEqual(bytes);
    await f.stop(); expect(await readFile(f.output)).toEqual(bytes);
  } finally { await f.close(); }
}, 40000);

for (const json of [true, false]) {
it(`keeps the saved receipt when terminal display fails after successful local verification (${json ? "JSON" : "plain text"})`, async () => {
  const f = await fixture();
  try {
    const pending = await f.cli([...f.args, "--yes"]); expect(pending.code, pending.err).toBe(3);
    expect((await f.cli(["agents", "approve", "--approval-id", pending.data.data.approvalId, "--yes"])).code).toBe(0);
    const result = await f.cli([...f.args, "--yes"], undefined, true, json);
    expect(result.code).toBe(1);
    const bytes = await readFile(f.output);
    if (json) {
    expect(result.data.status).toBe("saved-result-display-failed");
    expect(result.data.audioOutput).toMatchObject({ saved: true, status: "saved", outcomeUnknown: false, bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex") });
    expect(result.data.retryAllowed).toBe(false);
    } else {
      expect(result.err).toContain(`Saved WAV: ${f.output}`); expect(result.err).toContain(`Bytes: ${bytes.length}`);
      expect(result.err).toContain(`SHA-256: ${createHash("sha256").update(bytes).digest("hex")}`);
      const history = await f.cli(["forge", "runs"]); expect(history.code, history.err).toBe(0);
      expect(history.data.data.runs).toHaveLength(1);
      expect(result.err).toContain(`Run: ${history.data.data.runs[0].runId}`); expect(result.err).toContain("do not regenerate");
    }
    expect(f.operations).toHaveBeenCalledOnce();
    expect(result.err).not.toContain("audioBase64");
  } finally { await f.close(); }
}, 40000);
}

it("does not bypass the full speech approval when the parent tool has a broad allow decision", async () => {
  const f = await fixture(false);
  try {
    const denied = await f.cli([...f.args, "--yes"]);
    expect(denied.code).toBe(1); expect(denied.data.code).toBe("FORGE_MEDIA_APPROVAL_REQUIRED");
    expect(f.operations).not.toHaveBeenCalled(); expect(f.modelCalls).not.toHaveBeenCalled();
    await expect(access(f.output)).rejects.toThrow();
  } finally { await f.close(); }
}, 40000);

for (const kind of ["top", "run"] as const) {
  it(`does not return a completed artifact when the ${kind} governance lease fails during cleanup`, async () => {
    const f = await fixture();
    try {
      const pending = await f.cli([...f.args, "--yes"]); expect(pending.code, pending.err).toBe(3);
      expect((await f.cli(["agents", "approve", "--approval-id", pending.data.data.approvalId, "--yes"])).code).toBe(0);
      const failing = (lease: any) => ({ ...lease, async release() {
        await lease.release();
        throw Object.assign(Error("fixture lease cleanup failure"), { code: `FIXTURE_${kind.toUpperCase()}_RELEASE_FAILED` });
      } });
      if (kind === "run") {
        const service = f.app.agentGovernance.service, original = service.authorizeAgentExecution.bind(service);
        vi.spyOn(service, "authorizeAgentExecution").mockImplementation(async (...args: any[]) => {
          const result = await original(...args); return { ...result, executionLease: failing(result.executionLease) };
        });
      } else {
        const proxy = f.app.agentGovernance.toolProxy, original = proxy.enforce.bind(proxy);
        vi.spyOn(proxy, "enforce").mockImplementation(async (input: any) => {
          const result = await original(input);
          return input.toolName === "forge_orchestrate" && result.outcome === "allow"
            ? { ...result, executionLease: failing(result.executionLease) } : result;
        });
      }
      const rejected = await f.cli([...f.args, "--yes"]);
      expect(rejected.code, rejected.out).toBe(1); expect(rejected.data.code).toBe("FORGE_EXTERNAL_EFFECT_OUTCOME_UNCERTAIN");
      expect(rejected.data.retryAllowed).toBe(false); expect(f.operations).toHaveBeenCalledOnce();
      expect(rejected.err).not.toContain("audioBase64"); await expect(access(f.output)).rejects.toThrow();
      const history = await f.cli(["forge", "runs"]); expect(history.code, history.err).toBe(0);
      expect(history.data.data.runs).toHaveLength(1);
      expect(history.data.data.runs[0]).toMatchObject({ status: "failed", generation: { status: "completed" },
        mediaDelivery: { status: "unknown", retrySafe: false },
        error: { cleanupCodes: [kind === "top" ? "FORGE_TOP_ACTION_LEASE_RELEASE_FAILED" : "FORGE_RUN_LEASE_RELEASE_FAILED"] } });
      expect(history.out).not.toContain("audioBase64");
    } finally { await f.close(); }
  }, 40000);
}

it("refuses terminal audio redaction after generation without a file or an automatic second provider call", async () => {
  const f = await fixture();
  try {
    const pending = await f.cli([...f.args, "--yes"]); expect(pending.code, pending.err).toBe(3);
    expect((await f.cli(["agents", "approve", "--approval-id", pending.data.data.approvalId, "--yes"])).code).toBe(0);
    const original = f.app.agentGovernance.toolProxy.enforceResult.bind(f.app.agentGovernance.toolProxy);
    vi.spyOn(f.app.agentGovernance.toolProxy, "enforceResult").mockImplementation(async (input: any) => {
      const verdict = await original(input);
      if (input.toolName === "forge_orchestrate" && verdict.result?.result?.media) verdict.result.result.media.artifacts[0].audioBase64 = "redacted";
      return verdict;
    });
    const rejected = await f.cli([...f.args, "--yes"]);
    expect(rejected.code, rejected.out).toBe(1); expect(rejected.data.retryAllowed).toBe(false);
    expect(rejected.data.code).toBe("FORGE_EXTERNAL_EFFECT_OUTCOME_UNCERTAIN");
    expect(f.operations).toHaveBeenCalledOnce(); expect(f.modelCalls).not.toHaveBeenCalled();
    await expect(access(f.output)).rejects.toThrow(); expect(rejected.err).not.toContain("audioBase64");
    const history = await f.cli(["forge", "runs"]); expect(history.code, history.err).toBe(0);
    expect(history.data.data.runs).toHaveLength(1);
    expect(history.data.data.runs[0]).toMatchObject({ status: "failed", generation: { status: "completed" },
      mediaDelivery: { status: "unknown", retrySafe: false } });
  } finally { await f.close(); }
}, 40000);
