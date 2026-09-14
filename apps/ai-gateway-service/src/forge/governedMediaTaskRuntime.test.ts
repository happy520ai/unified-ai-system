import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GatewayService } from "../core/gatewayService.js";
import { ProviderRegistry } from "../providers/providerRegistry.js";
import { createFakeProvider } from "../providers/fakeProvider.js";
import { createAgentGovernanceToolProxy } from "../agent-governance/toolProxy.ts";
import { createGovernedMediaTaskExecution, assertGovernedMediaResultUnchanged } from "./governedMediaTaskRuntime.ts";
import { resolveGovernedMediaTaskRequest, readGovernedMediaTaskReview } from "./governedMediaTaskProfile.ts";

const profile = Object.freeze({ id: "approved-speech", tenantId: "tenant-a", providerId: "local-fake-provider",
  modelId: "local-fake-model", voice: "alloy", format: "wav-pcm16", maxTextBytes: 1024,
  maxAudioBytes: 8192, maxDurationMs: 1000, timeoutMs: 1000 });
const text = "  Read this exact reviewed sentence.  ";
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const coded = (code: string) => Object.assign(new Error("Synthetic fixture failure"), { code });
function review() {
  return resolveGovernedMediaTaskRequest({ AI_GATEWAY_FORGE_MEDIA_PROFILES_JSON: JSON.stringify([profile]) },
    { profileId: profile.id, text }, profile.tenantId)!;
}
function pcm(frames = 8) {
  const bytes = Buffer.alloc(44 + frames * 2);
  bytes.write("RIFF"); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVE", 8);
  bytes.write("fmt ", 12); bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36); bytes.writeUInt32LE(frames * 2, 40); return bytes;
}
function speech(bytes = pcm()): any {
  return { success: true, binary: true, contentType: "audio/wav", audioBuffer: bytes,
    data: { provider: profile.providerId, model: profile.modelId, voice: profile.voice, format: "wav", bytes: bytes.length,
      accessToken: "SYNTHETIC_RAW_SECRET" }, raw: { apiKey: "SYNTHETIC_RAW_SECRET" } };
}

// Real Tool Proxy and Gateway provider-operation code; only authority storage and raw TTS are synthetic.
function fixture(options: { maxRecords?: number; deniedFields?: string[]; approvalSwap?: string; defaultDemo?: boolean } = {}) {
  const state = { agentActive: true, fenceActive: true, releases: 0 };
  const context = { agentId: "agt_media", tenantId: profile.tenantId, userId: "owner", permissions: ["chat:use"], requestId: "req_media" };
  const policy: any = { agentId: context.agentId, policyHash: "sha256:media-fixture", expiresAt: "2099-01-01T00:00:00Z",
    grantedTools: ["media_synthesize_speech"], toolDecisions: { media_synthesize_speech: options.approvalSwap ? "require_approval" : "allow" },
    permissions: { canWrite: true, canSendExternalMessage: true }, limits: { maxToolCalls: 5, maxRecords: options.maxRecords ?? 1 },
    requirements: { auditRequired: true }, scope: { deniedOutputFields: options.deniedFields ?? [] } };
  const service: any = {
    expireAgents: vi.fn(async () => 0),
    getAgent: vi.fn(async () => ({ status: state.agentActive ? "ACTIVE" : "REVOKED", ownerUserId: "owner" })),
    loadVerifiedPolicy: vi.fn(async () => ({ policy })),
    reserveUsage: vi.fn(async () => ({ allowed: true })), releaseUsage: vi.fn(async () => undefined),
    getUsage: vi.fn(async () => ({ toolCalls: 0, steps: 0, records: 0 })), emitAudit: vi.fn(async () => undefined),
    acquireToolExecutionLease: vi.fn(async () => ({ release() { state.releases++; } })),
    findApprovedArguments: vi.fn(async () => ({ approvalId: "apr_media" })),
    consumeApprovedArguments: vi.fn(async (input: any) => ({ approvalId: "apr_media",
      args: { ...input.args, [options.approvalSwap!]: "changed-after-review" } })),
  };
  const toolProxy = createAgentGovernanceToolProxy({ service });
  const enforce = vi.spyOn(toolProxy, "enforce"), enforceResult = vi.spyOn(toolProxy, "enforceResult");
  const registry = new ProviderRegistry(); registry.register(createFakeProvider({ providerId: profile.providerId,
    modelId: profile.modelId, providerType: "fake", enabled: true, capabilities: ["chat"] } as any));
  const gatewayService = new GatewayService({ providerRegistry: registry,
    runtimeConfig: { providerMode: "fake", realProviderEnabled: false, enabledProviders: [profile.providerId] },
    requestLogger: { log: async () => undefined }, enterpriseAudit: { recordAudit: async () => undefined } });
  const operation = vi.spyOn(gatewayService, "executeProviderOperation");
  const raw = { generateImage: vi.fn(), generateEmbedding: vi.fn(), transcribeAudio: vi.fn(), synthesizeSpeech: vi.fn(async (_args: any) => speech()) };
  const assertActive = vi.fn(async (_phase: string) => {
    if (!state.fenceActive) throw coded("FIXTURE_FENCE_REVOKED");
    if (!state.agentActive) throw coded("AGENT_NOT_ACTIVE");
  });
  const input = { request: review(), goal: "Produce exactly the approved speech artifact", approvalId: "apr_media", context,
    toolProxy, executionLease: { assertActive }, policyHash: policy.policyHash,
    modelSelection: { providerId: profile.providerId, modelId: profile.modelId }, gatewayService,
    ...(options.defaultDemo ? {} : { rawAdapter: raw }) };
  const create = (overrides: Partial<Parameters<typeof createGovernedMediaTaskExecution>[0]> = {}) => createGovernedMediaTaskExecution({ ...input, ...overrides });
  const task = { id: "media-tts", goal_id: "goal_media", agent_role: "media" };
  return { state, context, policy, service, toolProxy, enforce, enforceResult, operation, raw, assertActive, input, create, task };
}
afterEach(() => vi.restoreAllMocks());

describe("governed media runtime with real Gateway and Tool Proxy", () => {
  it("binds the approved inputs, dispatches once and returns exactly one independently hashed WAV", async () => {
    const f = fixture(), port = f.create();
    expect(await port.execute(f.task)).toMatchObject({ success: true, outcomeUnknown: false, filesModified: [], tokenUsage: null });
    expect(f.operation).toHaveBeenCalledOnce(); expect(f.raw.synthesizeSpeech).toHaveBeenCalledOnce();
    expect(f.operation.mock.calls[0][0]).toMatchObject({ operationType: "text_to_speech", providerId: profile.providerId,
      modelId: profile.modelId, path: "/forge/orchestrate" });
    expect(f.raw.synthesizeSpeech.mock.calls[0][0]).toMatchObject({ provider: profile.providerId, model: profile.modelId,
      input: text, voice: profile.voice, responseFormat: "wav", speed: 1, maxResponseBytes: profile.maxAudioBytes, maxRetries: 0 });
    expect(f.raw.synthesizeSpeech.mock.calls[0][0].signal).toBeInstanceOf(AbortSignal);
    expect(f.enforce.mock.calls[0][0]).toMatchObject({ toolName: "media_synthesize_speech", context: f.context,
      params: { approvalId: "apr_media", taskId: "media-tts", goalId: "goal_media", profileId: profile.id,
        profileHash: f.input.request.profileHash, text, textSha256: digest(text), textBytes: Buffer.byteLength(text),
        providerId: profile.providerId, modelId: profile.modelId, voice: profile.voice, userId: "owner",
        format: profile.format, maxAudioBytes: profile.maxAudioBytes, maxDurationMs: profile.maxDurationMs,
        goalDigest: digest(f.input.goal) } });
    expect(f.enforceResult.mock.calls[0][0].descriptor).toEqual({ kind: "zero-records" });
    const report = port.getResult();
    expect(report).toMatchObject({ success: true, synthetic: true, outcomeUnknown: false,
      usage: { reported: null, source: "synthetic", inputCharacters: Array.from(text).length, providerCalls: 1 } });
    expect(report.artifacts).toHaveLength(1);
    const artifact = report.artifacts[0], delivered = Buffer.from(artifact.audioBase64, "base64");
    expect(delivered).toEqual(pcm()); expect(digest(delivered)).toBe(artifact.sha256); expect(delivered.length).toBe(artifact.bytes);
    expect(JSON.stringify(report)).not.toContain("SYNTHETIC_RAW_SECRET");
    expect(JSON.stringify(report)).not.toContain(text); expect(f.state.releases).toBe(1);
    report.artifacts[0].audioBase64 = "changed"; expect(port.getResult().artifacts[0].audioBase64).not.toBe("changed");
    await expect(port.execute(f.task)).rejects.toMatchObject({ code: "FORGE_MEDIA_CAPABILITY_INVALID" });
  });

  it("uses an explicitly synthetic tone for the server default fake path", async () => {
    const f = fixture({ defaultDemo: true }), port = f.create();
    expect(port.summary).toContain("synthetic demo WAV");
    expect(await port.execute(f.task)).toMatchObject({ success: true });
    const result = port.getResult(), bytes = Buffer.from(result.artifacts[0].audioBase64, "base64");
    expect(result.synthetic).toBe(true); expect(result.usage.reported).toBeNull();
    expect(bytes.subarray(44).some(value => value !== 0)).toBe(true);
    expect(result.artifacts[0]).toMatchObject({ sampleRate: 24000, channels: 1, bitsPerSample: 16 });
    expect(f.operation).toHaveBeenCalledOnce(); expect(f.raw.synthesizeSpeech).not.toHaveBeenCalled();
  });

  it("rejects tenant-owner and model misbindings before effects", () => {
    const f = fixture();
    expect(() => f.create({ context: { ...f.context, tenantId: "tenant-b" } })).toThrowError(expect.objectContaining({ code: "FORGE_MEDIA_OWNER_MISMATCH" }));
    expect(() => f.create({ modelSelection: { providerId: profile.providerId, modelId: "wrong-model" } }))
      .toThrowError(expect.objectContaining({ code: "FORGE_MEDIA_MODEL_SELECTION_MISMATCH" }));
    expect(f.operation).not.toHaveBeenCalled(); expect(f.raw.synthesizeSpeech).not.toHaveBeenCalled();
  });

  it("rejects injected profile fields and tampered frozen review hashes", () => {
    const input = { profileId: profile.id, text, voice: "other-voice" };
    expect(() => resolveGovernedMediaTaskRequest({ AI_GATEWAY_FORGE_MEDIA_PROFILES_JSON: JSON.stringify([profile]) }, input, profile.tenantId)).toThrow();
    const request = review(); expect(Object.isFrozen(request.profile)).toBe(true);
    expect(() => readGovernedMediaTaskReview({ ...request, text: "Changed text" })).toThrow();
    expect(() => readGovernedMediaTaskReview({ ...request, profileHash: "0".repeat(64) })).toThrow();
  });

  it.each(["text", "voice", "modelId", "approvalId", "profileHash"])("rejects consumed approval parameter substitution of %s before dispatch", async (field) => {
    const f = fixture({ approvalSwap: field });
    expect(await f.create().execute(f.task)).toMatchObject({ success: false, error: "FORGE_MEDIA_APPROVED_PARAMS_MISMATCH" });
    expect(f.service.consumeApprovedArguments).toHaveBeenCalledOnce(); expect(f.operation).not.toHaveBeenCalled();
    expect(f.raw.synthesizeSpeech).not.toHaveBeenCalled(); expect(f.state.releases).toBe(1);
  });

  it.each(["agent", "fence"])("blocks %s revocation before generation", async (kind) => {
    const f = fixture(); if (kind === "agent") f.state.agentActive = false; else f.state.fenceActive = false;
    const port = f.create(); expect(await port.execute(f.task)).toMatchObject({ success: false, outcomeUnknown: false });
    expect(port.getResult().artifacts).toEqual([]); expect(f.operation).not.toHaveBeenCalled(); expect(f.raw.synthesizeSpeech).not.toHaveBeenCalled();
  });

  it("also rechecks revoked Agent state in the real Tool Proxy", async () => {
    const f = fixture(); f.state.agentActive = false; f.assertActive.mockResolvedValue(undefined);
    const port = f.create(); expect(await port.execute(f.task)).toMatchObject({ success: false, error: "FORGE_MEDIA_ACTION_DENIED" });
    expect(f.enforce).toHaveBeenCalledOnce(); expect(f.service.getAgent).toHaveBeenCalledOnce();
    expect(f.operation).not.toHaveBeenCalled(); expect(f.raw.synthesizeSpeech).not.toHaveBeenCalled();
  });

  it.each(["agent", "fence"])("blocks delivery if %s is revoked after generation", async (kind) => {
    const f = fixture(); f.raw.synthesizeSpeech.mockImplementation(async () => {
      if (kind === "agent") f.state.agentActive = false; else f.state.fenceActive = false; return speech();
    });
    const port = f.create(); expect(await port.execute(f.task)).toMatchObject({ success: false });
    expect(port.getResult().artifacts).toEqual([]); expect(f.raw.synthesizeSpeech).toHaveBeenCalledOnce(); expect(f.state.releases).toBe(1);
  });

  it("does not replay or expose a provider error with unknown completion", async () => {
    const f = fixture(); f.raw.synthesizeSpeech.mockRejectedValue(Object.assign(new Error("SYNTHETIC_PRIVATE_DIAGNOSTIC"),
      { code: "FIXTURE_CONNECTION_LOST", retryable: true }));
    const port = f.create(); expect(await port.execute(f.task)).toMatchObject({ success: false, outcomeUnknown: true });
    const result = port.getResult(); expect(result).toMatchObject({ code: "FIXTURE_CONNECTION_LOST", artifacts: [], usage: { reported: null, providerCalls: 1 } });
    expect(JSON.stringify(result)).not.toContain("SYNTHETIC_PRIVATE_DIAGNOSTIC");
    expect(f.operation).toHaveBeenCalledOnce(); expect(f.raw.synthesizeSpeech).toHaveBeenCalledOnce();
  });

  it.each(["empty", "malformed", "oversize", "duration", "wrong-model"])("rejects %s provider artifacts independently of success flags", async (kind) => {
    const f = fixture(); let result = speech();
    if (kind === "empty") result = speech(Buffer.alloc(0));
    else if (kind === "malformed") result = speech(Buffer.alloc(60));
    else if (kind === "oversize") result = speech(Buffer.alloc(profile.maxAudioBytes + 1));
    else if (kind === "duration") { const bytes = pcm(8001); result = speech(bytes); }
    else result.data.model = "wrong-model";
    f.raw.synthesizeSpeech.mockResolvedValue(result);
    const request = kind === "duration" ? resolveGovernedMediaTaskRequest({ AI_GATEWAY_FORGE_MEDIA_PROFILES_JSON: JSON.stringify([{ ...profile, maxAudioBytes: 20000 }]) },
      { profileId: profile.id, text }, profile.tenantId)! : f.input.request;
    const expectedCode = kind === "empty" ? "FORGE_MEDIA_WAV_EMPTY_OR_TRUNCATED" : kind === "malformed" ? "FORGE_MEDIA_WAV_CONTAINER_INVALID"
      : kind === "duration" ? "FORGE_MEDIA_WAV_DURATION_LIMIT" : "FORGE_MEDIA_RESULT_INVALID";
    const port = f.create({ request }); expect(await port.execute(f.task)).toMatchObject({ success: false, error: expectedCode });
    expect(port.getResult().artifacts).toEqual([]); expect(f.operation).toHaveBeenCalledOnce(); expect(f.raw.synthesizeSpeech).toHaveBeenCalledOnce();
  });

  it("fails closed when real Tool Proxy output redaction changes approved metadata", async () => {
    const f = fixture({ deniedFields: ["voice"] }), port = f.create();
    expect(await port.execute(f.task)).toMatchObject({ success: false, error: "FORGE_MEDIA_RESULT_DENIED" });
    expect(port.getResult().artifacts).toEqual([]); expect(f.enforceResult).toHaveBeenCalledOnce();
  });

  it("rejects a zero-record policy before any provider effect", async () => {
    const f = fixture({ maxRecords: 0 }), port = f.create();
    expect(await port.execute(f.task)).toMatchObject({ success: false, error: "FORGE_MEDIA_OUTPUT_LIMIT" });
    expect(port.getResult().artifacts).toEqual([]); expect(f.raw.synthesizeSpeech).not.toHaveBeenCalled(); expect(f.operation).not.toHaveBeenCalled();
  });

  it("rejects any modified final delivery projection", () => {
    const original = { success: true, artifacts: [{ sha256: "a".repeat(64) }] };
    expect(() => assertGovernedMediaResultUnchanged(original, structuredClone(original))).not.toThrow();
    expect(() => assertGovernedMediaResultUnchanged(original, { ...original, artifacts: [] }))
      .toThrowError(expect.objectContaining({ code: "FORGE_MEDIA_DELIVERY_DENIED" }));
  });
});
