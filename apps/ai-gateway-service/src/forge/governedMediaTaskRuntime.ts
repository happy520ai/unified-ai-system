import type { AgentGovernanceCallContext, AgentGovernanceToolProxy } from "../agent-governance/toolProxy.ts";
import type { ForgeMediaTaskProfile, ForgeMediaTaskReview } from "@unified-ai-system/shared-contracts";
import { stableStringify } from "@unified-ai-system/policy-engine";
import { createGovernedMultimodalAdapter } from "../providers/governedMultimodalAdapter.ts";
import { createMultimodalProviderAdapter } from "../providers/multimodalProviderAdapter.js";
import { inspectGovernedPcmWav } from "./governedMediaArtifact.ts";
import { MEDIA_TTS_TASK_ID, mediaTaskError, mediaTextHash, readGovernedMediaTaskReview, assertMediaModelSelection } from "./governedMediaTaskProfile.ts";

type Fence = { signal?: AbortSignal; assertActive?(phase: string): Promise<unknown> };
type RawAdapter = Parameters<typeof createGovernedMultimodalAdapter>[0]["adapter"];
type RawOptions = NonNullable<Parameters<typeof createMultimodalProviderAdapter>[0]>;
type Gateway = Parameters<typeof createGovernedMultimodalAdapter>[0]["gatewayService"];
const ZERO = Object.freeze({ kind: "zero-records" as const });
const safeCode = (error: any) => typeof error?.code === "string" && /^[A-Za-z0-9_]{1,100}$/u.test(error.code) ? error.code : "FORGE_MEDIA_FAILED";

function readSpeechBytes(value: unknown, profile: ForgeMediaTaskProfile): Buffer {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw mediaTaskError("FORGE_MEDIA_RESULT_INVALID");
  const result = value as Record<string, unknown>;
  if (!result.data || typeof result.data !== "object" || Array.isArray(result.data)) throw mediaTaskError("FORGE_MEDIA_RESULT_INVALID");
  const data = result.data as Record<string, unknown>, audio = result.audioBuffer;
  if (result.success !== true || result.binary !== true || result.contentType !== "audio/wav" || !Buffer.isBuffer(audio)
    || audio.length > profile.maxAudioBytes || data.provider !== profile.providerId || data.model !== profile.modelId
    || data.voice !== profile.voice || data.format !== "wav" || data.bytes !== audio.length) throw mediaTaskError("FORGE_MEDIA_RESULT_INVALID");
  return Buffer.from(audio);
}

/** An explicitly synthetic tone exercises delivery; it is not a spoken rendition. */
function createDemoSpeechAdapter(profile: ForgeMediaTaskProfile): RawAdapter {
  const unsupported = async () => { throw mediaTaskError("FORGE_MEDIA_DEMO_OPERATION_UNSUPPORTED"); };
  return { generateImage: unsupported, generateEmbedding: unsupported, transcribeAudio: unsupported,
    async synthesizeSpeech(input: Record<string, any>) {
      input.signal?.throwIfAborted();
      const rate = 24000, frames = Math.min(2400, Math.floor((profile.maxAudioBytes - 44) / 2), Math.floor(profile.maxDurationMs * rate / 1000));
      const dataBytes = frames * 2, bytes = Buffer.alloc(44 + dataBytes);
      bytes.write("RIFF"); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVE", 8);
      bytes.write("fmt ", 12); bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
      bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
      bytes.write("data", 36); bytes.writeUInt32LE(dataBytes, 40);
      const frequency = 220 + parseInt(mediaTextHash(input.input).slice(0, 2), 16);
      for (let n = 0; n < frames; n++) bytes.writeInt16LE(Math.round(1000 * Math.sin(2 * Math.PI * frequency * n / rate)), 44 + n * 2);
      input.signal?.throwIfAborted();
      return { success: true, binary: true, audioBuffer: bytes, contentType: "audio/wav",
        data: { provider: "local-fake-provider", model: "local-fake-model", voice: input.voice, format: "wav", bytes: bytes.length }, raw: { fake: true } };
    } };
}

/** One private capability, bound to the fully reviewed text/profile and the current Forge run. */
export function createGovernedMediaTaskExecution(input: {
  request: ForgeMediaTaskReview; goal: string; approvalId: string;
  context: AgentGovernanceCallContext & { userId: string; permissions: readonly string[] }; toolProxy: AgentGovernanceToolProxy;
  executionLease: Fence; signal?: AbortSignal | null; policyHash: string; modelSelection: unknown;
  gatewayService: Gateway; rawAdapter?: RawAdapter; runtimeCredentialStore?: RawOptions["runtimeCredentialStore"]; env?: RawOptions["env"];
}) {
  const review = readGovernedMediaTaskReview(input.request), profile = review.profile;
  assertMediaModelSelection(review, input.modelSelection);
  if (!input.policyHash || !input.approvalId || typeof input.gatewayService?.executeProviderOperation !== "function"
    || typeof input.goal !== "string" || !input.goal.trim()) throw mediaTaskError("FORGE_MEDIA_RUNTIME_UNAVAILABLE", 503);
  const identity = Object.freeze({ ...input.context });
  if (profile.tenantId !== identity.tenantId || typeof identity.userId !== "string" || !identity.userId
    || identity.userId.length > 256 || /[\u0000-\u001f\u007f]/u.test(identity.userId)) throw mediaTaskError("FORGE_MEDIA_OWNER_MISMATCH", 403);
  if (!identity.permissions?.includes("*") && !identity.permissions?.includes("chat:use")) throw mediaTaskError("FORGE_MEDIA_CHAT_PERMISSION_REQUIRED", 403);
  const goalDigest = mediaTextHash(input.goal), synthetic = profile.providerId === "local-fake-provider";
  const enforce = input.toolProxy.enforce.bind(input.toolProxy), enforceResult = input.toolProxy.enforceResult.bind(input.toolProxy);
  let claimed = false, terminal: any = null;
  return Object.freeze({ taskId: MEDIA_TTS_TASK_ID, summary: synthetic ? "Produce a synthetic demo WAV" : "Produce the approved speech WAV",
    getResult() { return terminal ? structuredClone(terminal) : null; },
    async execute(task: { id: string; goal_id?: string; agent_role?: string; agentRole?: string }, context: { signal?: AbortSignal } = {}) {
      if (claimed || task.id !== MEDIA_TTS_TASK_ID || (task.agent_role ?? task.agentRole) !== "media"
        || typeof task.goal_id !== "string" || !/^[A-Za-z0-9_.:-]{1,160}$/u.test(task.goal_id)) throw mediaTaskError("FORGE_MEDIA_CAPABILITY_INVALID", 403);
      claimed = true;
      const abort = new AbortController();
      const signal = AbortSignal.any([abort.signal, ...[input.signal, input.executionLease.signal, context.signal].filter((value): value is AbortSignal => Boolean(value))]);
      const timer = setTimeout(() => abort.abort(mediaTaskError("FORGE_MEDIA_DEADLINE_EXCEEDED")), profile.timeoutMs);
      const binding = Object.freeze({ taskId: MEDIA_TTS_TASK_ID, goalId: task.goal_id, goalDigest, agentId: identity.agentId,
        tenantId: identity.tenantId, userId: identity.userId, profileId: profile.id, profileHash: review.profileHash,
        providerId: profile.providerId, modelId: profile.modelId, voice: profile.voice, textSha256: review.textSha256, textBytes: review.textBytes });
      let calls = 0, providerSettled = false, authorization: Awaited<ReturnType<typeof enforce>> | undefined;
      let failure: any, cleanupErrorCode: string | undefined;
      const active = async (phase = "reserve") => { signal.throwIfAborted(); await input.executionLease.assertActive?.(phase); signal.throwIfAborted(); };
      const usage = () => ({ source: synthetic ? "synthetic" : "not-reported", reported: null,
        inputCharacters: Array.from(review.text).length, providerCalls: calls });
      try {
        await active();
        const params = { ...binding, approvalId: input.approvalId, text: review.text, format: profile.format,
          maxAudioBytes: profile.maxAudioBytes, maxDurationMs: profile.maxDurationMs };
        authorization = await enforce({ context: identity, toolName: "media_synthesize_speech", params,
          resourceContext: { resourceKeys: { forgeTaskId: MEDIA_TTS_TASK_ID, mediaProfileId: profile.id, mediaProfileHash: review.profileHash,
            providerId: profile.providerId, modelId: profile.modelId, mediaTextHash: review.textSha256 }, resources: [`media:tts:${profile.id}:${review.textSha256}`] } });
        await active("commit");
        if (authorization.outcome !== "allow" || authorization.policy?.policyHash !== input.policyHash || !authorization.executionLease) throw mediaTaskError("FORGE_MEDIA_ACTION_DENIED", 403);
        if (authorization.policy.limits?.maxRecords === 0) throw mediaTaskError("FORGE_MEDIA_OUTPUT_LIMIT", 403);
        if (authorization.approvedParams !== undefined && stableStringify(authorization.approvedParams) !== stableStringify(params)) throw mediaTaskError("FORGE_MEDIA_APPROVED_PARAMS_MISMATCH", 403);
        const raw = input.rawAdapter ?? (synthetic ? createDemoSpeechAdapter(profile) : createMultimodalProviderAdapter({
          runtimeCredentialStore: input.runtimeCredentialStore, env: input.env ?? {} }));
        const mediaGateway: Gateway = { executeProviderOperation(operation) {
          if (operation.operationType !== "text_to_speech" || operation.providerId !== profile.providerId || operation.modelId !== profile.modelId) {
            throw mediaTaskError("FORGE_MEDIA_CAPABILITY_INVALID", 403);
          }
          // Only this server-owned, approved demo path declares a fake provider type.
          // General multimodal requests cannot acquire it merely by naming a fake provider.
          return input.gatewayService.executeProviderOperation(synthetic ? { ...operation, providerType: "fake" } : operation);
        } };
        const adapter = createGovernedMultimodalAdapter({ gatewayService: mediaGateway, routePath: "/forge/orchestrate",
          adapter: { generateImage: args => raw.generateImage(args), generateEmbedding: args => raw.generateEmbedding(args),
            transcribeAudio: args => raw.transcribeAudio(args), async synthesizeSpeech(args: Record<string, any>) {
              await active("dispatch"); calls += 1;
              const result = await raw.synthesizeSpeech(args); providerSettled = true; return result;
            } } });
        const result = await adapter.synthesizeSpeech({ provider: profile.providerId, model: profile.modelId, input: review.text,
          voice: profile.voice, responseFormat: "wav", speed: 1, signal, maxResponseBytes: profile.maxAudioBytes, maxRetries: 0 });
        const bytes = readSpeechBytes(result, profile);
        await active("complete");
        const artifact = inspectGovernedPcmWav(bytes, { maxBytes: profile.maxAudioBytes, maxDurationMs: profile.maxDurationMs });
        // This action meters metadata. The one audio artifact is metered once at the final Forge boundary.
        const receipt = { success: true, request: binding, artifact, usage: usage(), synthetic };
        const verdict = await enforceResult({ context: identity, toolName: "media_synthesize_speech", policy: authorization.policy,
          result: receipt, descriptor: ZERO });
        await active("complete");
        if (verdict.verdict !== "allow" || stableStringify(verdict.result) !== stableStringify(receipt)) throw mediaTaskError("FORGE_MEDIA_RESULT_DENIED", 403);
        terminal = { version: 1, kind: "tts", success: true, outcomeUnknown: false, synthetic, request: binding,
          usage: usage(), artifacts: [{ ...artifact, audioBase64: bytes.toString("base64") }] };
      } catch (error) { failure = error; }
      try { await authorization?.executionLease?.release(); }
      catch (error) { if (!failure) failure = error; else cleanupErrorCode = safeCode(error); }
      try { if (!failure) await active("complete"); }
      catch (error) { failure = error; }
      clearTimeout(timer);
      if (failure) {
        const outcomeUnknown = (calls > 0 && !providerSettled) || failure?.outcomeUnknown === true || failure?.persistenceOutcomeUnknown === true;
        terminal = { version: 1, kind: "tts", success: false, outcomeUnknown, synthetic, request: binding, usage: usage(), artifacts: [],
          code: safeCode(failure), ...(cleanupErrorCode ? { cleanupErrorCode } : {}) };
        return { success: false, outcomeUnknown, error: terminal.code, output: "The approved speech artifact was not delivered.", filesModified: [], tokenUsage: null };
      }
      return { success: true, outcomeUnknown: false, filesModified: [], tokenUsage: null };
    } });
}

export function assertGovernedMediaResultUnchanged(expected: unknown, delivered: unknown): void {
  if (!expected || stableStringify(expected) !== stableStringify(delivered)) throw mediaTaskError("FORGE_MEDIA_DELIVERY_DENIED", 403);
}
