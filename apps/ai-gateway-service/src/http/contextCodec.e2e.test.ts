// @test-isolation process
import { once } from "node:events";
import { createHash } from "node:crypto";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { expect, it, vi } from "vitest";
import { decodeContextData } from "@unified-ai-system/context-codec-core";
import { createGatewayClient } from "@unified-ai-system/shared-sdk";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { observeProviderUsage } from "../providers/providerUsageObservation.ts";
import { createGatewayHttpServer } from "./httpServer.js";
import { runCli } from "../../../agent-console/src/cli-core.js";

it("verifies actual native HTTP/SDK codec requests, bounded comparisons and retained unknown outcomes", async () => {
  const parent = await realpath(tmpdir()), root = await mkdtemp(join(parent, "uai-codec-http-"));
  const token = "codec-http-owned-fixture";
  let app: any, server: any;
  try {
    const env = { NODE_ENV: "test", AI_GATEWAY_PROVIDER_MODE: "fake", AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory", KNOWLEDGE_STORAGE_MODE: "memory", AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1",
      AI_GATEWAY_CONTEXT_CODEC_ENABLED: "true", AI_GATEWAY_CONTEXT_CODEC_MIN_ESTIMATED_SAVING_PERCENT: "30",
      AI_GATEWAY_MODEL_LIBRARY_STATE_PATH: join(root, "models.json"), WORKFLOW_OUTPUT_DIR: join(root, "artifacts"),
      WORKFORCE_PLAN_STORE_PATH: join(root, "plans.json"), WORKFORCE_EXECUTION_DIR: join(root, "execution"), AI_GATEWAY_USAGE_LOG_DIR: join(root, "usage"),
      AI_GATEWAY_AGENT_EXEC_WORKING_DIRECTORY: root, AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
      AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"), AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "codec-http-fixture-signing-0123456789",
      AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(root, "clients.json"), AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(root, "clients.jsonl"), AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CONTROL_DIR: join(root, "client-control"),
      PME_ENTERPRISE_AUTH_ENABLED: "true", PME_AUTH_TOKEN: token, PME_AUTH_USER_ID: "owner", PME_AUTH_TENANT_ID: "tenant-a", PME_AUTH_ROLE: "admin",
      PME_ENTERPRISE_PLATFORM_TENANT_ID: "tenant-a", PME_ENTERPRISE_USER_STORE_PATH: join(root, "users.json"), PME_API_KEY_STORE_PATH: join(root, "keys.json"),
      PME_AUDIT_LOG_PATH: join(root, "audit.jsonl"), PME_AUDIT_CHAIN_PATH: join(root, "audit-chain.jsonl") };
    app = createGatewayApplication(env);
    const provider = app.providerRegistry.get("local-fake-provider"), originalGenerate = provider.generate.bind(provider);
    const sourceData = Array.from({ length: 30 }, (_, index) => ({ count: index, ref: `document://item-${index}`, note: `中文 line\n${index}` }));
    const source = JSON.stringify(sourceData, null, 8), expected = sourceData[3];
    const input = { request: { providerId: "local-fake-provider", model: "local-fake-model", options: { temperature: 0, maxOutputTokens: 256 },
      messages: [{ role: "system", content: "Return ONLY JSON for the selected entry, preserving all fields." },
        { role: "user", content: source }, { role: "user", content: "Return the entry whose count is 3." }] },
      profile: "compact_trace", targets: [{ messageIndex: 1 }], expectedJson: expected, minReportedInputSavingPercent: 10 };
    const file = join(root, "case.json"); await writeFile(file, JSON.stringify(input));
    let mode = "normal", modelCalls = 0;
    vi.spyOn(provider, "generate").mockImplementation(async (call: any) => {
      modelCalls++;
      const base = await originalGenerate(call);
      const encoded = call.request.contextCodec.profile !== "off";
      const data = encoded ? decodeContextData(call.request.messages[1].content, "compact_trace") : JSON.parse(call.request.messages[1].content);
      expect(data).toEqual(sourceData);
      const answer = { ...data[3], ...(mode === "quality" && encoded ? { count: 999 } : {}) }, text = JSON.stringify(answer);
      // Synthetic counts exercise transport attribution; the selected provider remains explicitly fake.
      const inputCount = Math.ceil(JSON.stringify(call.request.messages).length / 4), outputCount = Math.ceil(text.length / 4);
      const usage = observeProviderUsage("openai", { prompt_tokens: inputCount, completion_tokens: outputCount, total_tokens: inputCount + outputCount }, true);
      return { ...base, text, message: { role: "assistant", content: text }, usage: usage.usage,
        raw: { ...base.raw, usageObservation: mode === "missing_usage" ? undefined : usage.usageObservation } };
    });
    const streamCalls = vi.spyOn(provider, "generateStream");
    const originalExecute = app.gatewayService.execute.bind(app.gatewayService);
    vi.spyOn(app.gatewayService, "execute").mockImplementation(async (body: any, execution: any) => {
      if (mode === "drift" && body.contextCodec?.profile !== "off") body.messages[0].content += " Additional context appeared.";
      const result = await originalExecute(body, execution);
      if (mode === "lost" && body.contextCodec?.profile !== "off" && result.success) {
        throw Object.assign(new Error("Synthetic response loss after provider completion."), { code: "FIXTURE_POST_EXECUTION_ERROR", statusCode: 503 });
      }
      return result;
    });
    server = createGatewayHttpServer(app); server.listen(0, "127.0.0.1"); await once(server, "listening");
    const url = `http://127.0.0.1:${server.address().port}`;
    async function cli(args: string[]) {
      let out = "", err = "";
      const code = await runCli(["codec", ...args, "--input", file, "--url", url, "--json"], { env: { AGENT_CONSOLE_ADMIN_KEY: token },
        stdout: { isTTY: false, write: (text: string) => { out += text; } }, stderr: { write: (text: string) => { err += text; } } });
      return { code, data: JSON.parse(out || err), out, err };
    }
    expect((await cli(["compare"])).data.status).toBe("preview"); expect(modelCalls).toBe(0);
    const success = await cli(["compare", "--yes"]);
    expect(success.code, success.out || success.err).toBe(0);
    expect(success.data).toMatchObject({ status: "synthetic_case_passed", sameInput: true, sameModelId: true, qualityMatched: true, usageComparable: true });
    expect(success.data.arms.baseline.usage.kind).toBe("synthetic");
    expect(success.data.inputSavingPercent).toBeGreaterThan(10);
    expect(success.data.requestReferences.baseline.idempotencyKey).not.toBe(success.data.requestReferences.encoded.idempotencyKey);
    expect(modelCalls).toBe(2);

    const client = createGatewayClient({ baseUrl: url, headers: { authorization: `Bearer ${token}` } });
    const events: any[] = [];
    for await (const event of client.chatStream({ ...input.request, taskType: "chat", contextCodec: { profile: "compact_trace",
      targets: [{ messageIndex: 1, contentSha256: createHash("sha256").update(source).digest("hex") }] } } as any)) events.push(event);
    expect(events.at(-1).type).toBe("done"); expect(events.at(-1).meta.contextCodec.status).toBe("applied");
    const streamedRequest = streamCalls.mock.calls[0][0] as { request: { messages: { content: string }[] } };
    expect(decodeContextData(streamedRequest.request.messages[1].content, "compact_trace")).toEqual(sourceData);

    mode = "quality";
    const quality = await cli(["compare", "--yes"]);
    expect(quality.code).toBe(1); expect(quality.data.qualityMatched).toBe(false);
    expect(JSON.parse(quality.data.arms.encoded.answerText).count).toBe(999);
    mode = "drift";
    const drift = await cli(["compare", "--yes"]);
    expect(drift.code).toBe(1); expect(drift.data).toMatchObject({ sameInput: false, qualityMatched: false, usageComparable: false });
    mode = "missing_usage";
    const noUsage = await cli(["compare", "--yes"]);
    expect(noUsage.code).toBe(1); expect(noUsage.data).toMatchObject({ qualityMatched: true, usageComparable: false, inputSavingPercent: null });
    mode = "normal"; app.gatewayService.runtimeConfig.chatContextCompaction.codecEnabled = false;
    const beforeDisabled = modelCalls, disabled = await cli(["compare", "--yes"]);
    expect(disabled.code).toBe(1); expect(disabled.data.reason).toBe("codec_not_eligible");
    expect(modelCalls - beforeDisabled).toBe(1); expect(disabled.data.arms.encoded).toBeUndefined();
    app.gatewayService.runtimeConfig.chatContextCompaction.codecEnabled = true;
    mode = "lost"; const beforeLoss = modelCalls, lost = await cli(["compare", "--yes"]);
    expect(lost.code).toBe(1);
    expect(lost.data).toMatchObject({ status: "not_completed", phase: "encoded", providerOutcome: "failed_or_unknown", automaticRetry: false });
    expect(lost.data.arms.baseline.qualityMatched).toBe(true); expect(modelCalls - beforeLoss).toBe(2);
    expect(lost.data.requestReferences.encoded.requestId).toBeTruthy();
  } finally {
    if (server) { await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }); await server.shutdownResources(); }
    const owned = await realpath(root); expect(dirname(owned)).toBe(parent); expect(basename(owned).startsWith("uai-codec-http-")).toBe(true);
    await rm(owned, { recursive: true, force: true });
  }
}, 60_000);
