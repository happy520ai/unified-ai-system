import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import * as codec from "@unified-ai-system/context-codec-core";
import { createFakeProvider } from "../providers/fakeProvider.js";
import { ProviderRegistry } from "../providers/providerRegistry.js";
import { GatewayService, bindFakeProviderExecution } from "./gatewayService.js";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const rows = Array.from({ length: 35 }, (_, index) => ({ name: `fact-${index}`, count: index, enabled: index % 2 === 0,
  ref: `document://source-${index}/section`, note: `中文 line\n${index}`, missing: null }));
const source = JSON.stringify(rows, null, 8);
function request(profile = "jsonl_facts", text = source): any {
  return { taskType: "chat", providerId: "codec-fixture", model: "codec-model", options: { temperature: 0, maxOutputTokens: 256 },
    messages: [{ role: "system", content: "Use the supplied facts. Preserve their references." },
      { role: "assistant", content: "Reading facts.", toolCalls: [{ id: "lookup-1", type: "function", function: { name: "lookup", arguments: "{}" } }] },
      { role: "tool", name: "lookup", toolCallId: "lookup-1", content: text, metadata: { citation: "document://source-1" } },
      { role: "user", content: "Describe fact-3 with its count and source." }],
    contextCodec: profile === "off" ? { profile } : { profile, targets: [{ messageIndex: 2, contentSha256: digest(text) }] } };
}
function setup(config: Record<string, any> = {}, extras: Record<string, any> = {}) {
  const registry = new ProviderRegistry();
  const provider = createFakeProvider({ providerId: "codec-fixture", modelId: "codec-model", providerType: "fake", capabilities: ["chat", "vision"], enabled: true, fixedLatencyMs: 0 });
  registry.register(provider);
  const generate = vi.spyOn(provider, "generate");
  const generateStream = vi.spyOn(provider, "generateStream");
  const service = new GatewayService({ providerRegistry: registry, runtimeConfig: { providerMode: "fake", realProviderEnabled: false,
    fallbackEnabled: false, chatContextCompaction: { thresholdMessages: 1, keepRecentTurns: 1, codecEnabled: true, codecMinEstimatedSavingPercent: 30, ...config } }, ...extras }) as any;
  return { service, provider, registry, generate, generateStream };
}

describe("Context Codec in actual gateway requests", () => {
  it.each(["yaml_state", "jsonl_facts", "compact_trace"] as const)("sends verified %s data while preserving the entire role/tool graph", async (profile) => {
    const { service, generate } = setup(), input = request(profile), before = structuredClone(input);
    const control = await service.execute(request("off"));
    const result = await service.execute(input);
    expect(result.success).toBe(true);
    const sent = generate.mock.calls[1][0].request;
    expect(codec.decodeContextData(sent.messages[2].content, profile)).toEqual(rows);
    expect(sent.messages).toHaveLength(before.messages.length);
    for (const index of [0, 1, 3]) expect(sent.messages[index]).toMatchObject(before.messages[index]);
    expect(sent.messages[2]).toMatchObject({ role: "tool", name: "lookup", toolCallId: "lookup-1", metadata: before.messages[2].metadata });
    expect(input).toEqual(before);
    const report = result.data.metadata.contextCodec;
    expect(report).toMatchObject({ profile, status: "applied", recovery: "exact-json-data", modelQuality: "not-evaluated", originalMessageCount: 4 });
    expect(report.inputHash).toBe(control.data.metadata.contextCodec.inputHash);
    expect(report.providerInputHash).not.toBe(report.inputHash);
    expect(report.selectedTextBytesAfter).toBeLessThan(report.selectedTextBytesBefore);
    expect(report.estimatedSavingPercent).toBeGreaterThanOrEqual(30);
    expect(report.targets[0].sourceTextHash).toBe(digest(source));
    expect(result.data.warnings.some((warning: any) => warning.code === "context_compacted")).toBe(false);
  });

  it("keeps every original message when disabled, a target changed, JSON is ambiguous, or savings are insufficient", async () => {
    const disabled = setup({ codecEnabled: false });
    const disabledResult = await disabled.service.execute(request());
    expect(disabledResult.data.metadata.contextCodec).toMatchObject({ status: "original", reason: "disabled", recovery: "not-applied" });
    expect(disabled.generate.mock.calls[0][0].request.messages[2].content).toBe(source);
    for (const text of ['{"a":1,"a":2}', '{"id":9007199254740993}', '{"a":1}']) {
      const { service, generate } = setup();
      const result = await service.execute(request("jsonl_facts", text));
      expect(result.success).toBe(true);
      expect(result.data.metadata.contextCodec.status).toBe("original");
      expect(result.data.metadata.contextCodec.providerInputHash).toBe(result.data.metadata.contextCodec.inputHash);
      expect(generate.mock.calls[0][0].request.messages[2].content).toBe(text);
      expect(generate.mock.calls[0][0].request.messages).toHaveLength(4);
    }
    const { service, generate } = setup(), changed = request();
    changed.messages[2].content = source + " ";
    const result = await service.execute(changed);
    expect(result.data.metadata.contextCodec.reason).toBe("target_changed");
    expect(generate.mock.calls[0][0].request.messages[2].content).toBe(changed.messages[2].content);
  });

  it("falls back atomically when the encoder returns a fact-changing artifact", async () => {
    const { service, generate } = setup();
    const real = codec.encodeContextData;
    const faulty = vi.spyOn(codec, "encodeContextData").mockImplementation((text, profile) => {
      const result = real(text, profile);
      return { ...result, text: result.text.replace("fact-3", "fact-X") };
    });
    try {
      const result = await service.execute(request());
      expect(result.success).toBe(true);
      expect(result.data.metadata.contextCodec).toMatchObject({ status: "original", reason: "fact_recovery_failed", targets: [] });
      expect(generate.mock.calls[0][0].request.messages[2].content).toBe(source);
    } finally { faulty.mockRestore(); }
  });

  it("exposes the actual stream receipt and preserves unselected multimodal parts", async () => {
    const { service, generateStream } = setup(), input = request();
    const image = { type: "image_url", image_url: { url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jrXYAAAAASUVORK5CYII=", detail: "low" } };
    input.messages[2] = { role: "user", content: [{ type: "text", text: source }, image, { type: "text", text: "Keep this exact text." }] };
    input.contextCodec.targets[0].partIndex = 0;
    const events = [];
    for await (const event of service.executeStream(input)) events.push(event);
    expect(events.at(-1)?.type).toBe("done");
    expect(events[0].meta.contextCodec.status).toBe("applied");
    expect(events.at(-1).meta.contextCodec).toEqual(events[0].meta.contextCodec);
    expect(generateStream.mock.calls[0][0].request.messages[2].content[1]).toEqual(image);
    expect(generateStream.mock.calls[0][0].request.messages[2].content[2]).toEqual({ type: "text", text: "Keep this exact text." });
    expect(codec.decodeContextData(generateStream.mock.calls[0][0].request.messages[2].content[0].text, "jsonl_facts")).toEqual(rows);
  });

  it("enforces the original input policy before formatting and rejects malformed or conflicting targets", async () => {
    const { service, generate } = setup({}, { contentGuardrails: { scan: (text: string) => ({ safe: !text.includes('"q":\n'), violations: [{ type: "original-input-policy" }] }) } });
    const blocked = await service.execute(request("jsonl_facts", '{"q":\n[1,2,3]}'));
    expect(blocked.success).toBe(false);
    expect(blocked.error.code).toBe("CONTENT_GUARDRAIL_BLOCKED");
    const invalid = request(); invalid.contextCodec.targets.push({ ...invalid.contextCodec.targets[0] });
    expect((await service.execute(invalid)).error.code).toBe("CONTEXT_CODEC_SELECTION_INVALID");
    const execution = {}; bindFakeProviderExecution(execution, { providerId: "different", modelId: "different" });
    expect((await service.execute(request(), execution)).error.code).toBe("PROVIDER_EXECUTION_BINDING_CONFLICT");
    expect(generate).not.toHaveBeenCalled();
  });

  it("uses the explicit model without weighted rerouting or shadow calls, and never trusts caller receipts", async () => {
    const weighted = { apply: vi.fn(() => ({ overrideProviderId: "other" })), shouldShadow: vi.fn(() => ({ providerId: "other" })) };
    const { service, generate } = setup({}, { weightedTrafficPolicy: weighted });
    const input = request(); input.metadata = { contextCodec: { status: "applied", inputHash: "forged" } };
    const result = await service.execute(input);
    expect(result.success).toBe(true);
    expect(generate.mock.calls[0][0].target).toMatchObject({ providerId: "codec-fixture", modelId: "codec-model" });
    expect(weighted.apply).not.toHaveBeenCalled(); expect(weighted.shouldShadow).not.toHaveBeenCalled();
    expect(result.data.metadata.contextCodec.inputHash).toMatch(/^[a-f0-9]{64}$/u);
    const noCodec = request(); delete noCodec.contextCodec; noCodec.metadata = input.metadata;
    service.weightedTrafficPolicy = null;
    expect((await service.execute(noCodec)).data.metadata.contextCodec).toBeUndefined();
    const aborted = new AbortController(); aborted.abort();
    const previousCalls = generate.mock.calls.length;
    expect((await service.execute(request(), { signal: aborted.signal })).success).toBe(false);
    const disconnected = new AbortController();
    disconnected.abort(Object.assign(new Error("caller disconnected"), { code: "CLIENT_DISCONNECTED" }));
    await expect(service.execute(request(), { signal: disconnected.signal })).rejects.toThrow("caller disconnected");
    expect(generate).toHaveBeenCalledTimes(previousCalls);
  });

  it("refuses input changes between codec verification and actual provider dispatch", async () => {
    const { service, generate } = setup(), input = request();
    const pending = service.execute(input);
    input.options.temperature = 0.8;
    const result = await pending;
    expect(result.success).toBe(false);
    expect(result.error.code).toBe("CONTEXT_CODEC_INPUT_CHANGED");
    expect(generate).not.toHaveBeenCalled();
  });
});
