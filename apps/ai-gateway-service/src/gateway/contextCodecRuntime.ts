import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { encodeContextData, decodeContextData, parseContextJson, estimateContextTokens } from "@unified-ai-system/context-codec-core";
import type { GatewayContextCodecReport, GatewayContextCodecSelection, MessageContentPart, MessageDto } from "@unified-ai-system/shared-contracts";

type Data = Record<string, any>;
type Config = { codecEnabled?: boolean; codecMinEstimatedSavingPercent?: number };
const reports = new WeakMap<object, GatewayContextCodecReport>();
const profiles = new Set(["yaml_state", "jsonl_facts", "compact_trace"]);
const hash = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const record = (value: unknown): value is Data => Boolean(value && typeof value === "object" && !Array.isArray(value));
function invalid(message: string): never {
  throw Object.assign(new Error(message), { code: "CONTEXT_CODEC_SELECTION_INVALID", category: "validation", statusCode: 400, retryable: false });
}

export function validateContextCodecRuntimeConfig(config: Config = {}): void {
  config ??= {};
  if (config.codecEnabled !== undefined && typeof config.codecEnabled !== "boolean") invalid("Context Codec enabled must be a boolean.");
  const threshold = config.codecMinEstimatedSavingPercent ?? 30;
  if (!Number.isFinite(threshold) || threshold < 0 || threshold >= 100) invalid("Context Codec estimated saving threshold must be between 0 and 100 (exclusive).");
}

function selectionOf(request: Data): GatewayContextCodecSelection {
  const selection = request.contextCodec;
  if (!record(selection)) invalid("Context Codec requires an explicit profile.");
  if (typeof request.providerId !== "string" || !request.providerId || typeof request.model !== "string" || !request.model) {
    invalid("Context Codec requires an explicit providerId and model; automatic routing is not used for this request.");
  }
  if (selection.profile === "off") {
    if (Object.keys(selection).length !== 1) invalid("The off profile accepts no targets or other options.");
    return { profile: "off" };
  }
  if (!profiles.has(selection.profile) || Object.keys(selection).some((key) => !["profile", "targets"].includes(key))
    || !Array.isArray(selection.targets) || selection.targets.length === 0 || selection.targets.length > 16) {
    invalid("Select a supported profile and between 1 and 16 JSON data targets.");
  }
  const seen = new Set<string>();
  for (const target of selection.targets) {
    if (!record(target) || Object.keys(target).some((key) => !["messageIndex", "partIndex", "contentSha256"].includes(key))
      || !Number.isSafeInteger(target.messageIndex) || target.messageIndex < 0
      || target.partIndex !== undefined && (!Number.isSafeInteger(target.partIndex) || target.partIndex < 0)
      || typeof target.contentSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(target.contentSha256)) invalid("Invalid Context Codec target or SHA-256.");
    const key = `${target.messageIndex}:${target.partIndex ?? "text"}`;
    if (seen.has(key)) invalid("A Context Codec target must not be repeated.");
    seen.add(key);
  }
  return selection as GatewayContextCodecSelection;
}

function inputHash(request: Data, messages: MessageDto[]): string {
  return hash(JSON.stringify({ messages, taskType: request.taskType, options: request.options,
    tools: request.tools, toolChoice: request.toolChoice, parallelToolCalls: request.parallelToolCalls,
    requiredCapabilities: request.requiredCapabilities, providerId: request.providerId, model: request.model,
    metadata: request.metadata, context: { ...request.context, requestId: undefined, traceId: undefined } }));
}

/** Server-created observations only. Caller metadata never supplies this receipt. */
export function readContextCodecReport(request: object): GatewayContextCodecReport | undefined {
  const report = reports.get(request);
  return report ? structuredClone(report) : undefined;
}

/** Async admission must not invalidate the exact input described by the codec receipt. */
export function assertContextCodecInput(request: Data): void {
  const report = reports.get(request);
  if (report && inputHash(request, request.messages) !== report.providerInputHash) {
    throw Object.assign(new Error("The request changed after Context Codec verification."),
      { code: "CONTEXT_CODEC_INPUT_CHANGED", category: "governance", retryable: false });
  }
}

/** Exclusive alternative at the existing compaction boundary; fallback never invokes a second compactor. */
export function applyGatewayContextCodec(request: Data, config: Config = {}): void {
  config ??= {};
  validateContextCodecRuntimeConfig(config);
  const selection = selectionOf(request);
  const originalMessages = request.messages as MessageDto[];
  const sourceHash = inputHash(request, originalMessages);
  const report: GatewayContextCodecReport = {
    version: "context-codec-request-v1", profile: selection.profile, status: "original", reason: "control",
    inputHash: sourceHash, providerInputHash: sourceHash,
    policyHash: hash(JSON.stringify({ enabled: config.codecEnabled === true, minEstimatedSavingPercent: config.codecMinEstimatedSavingPercent ?? 30 })),
    enabled: config.codecEnabled === true, minEstimatedSavingPercent: config.codecMinEstimatedSavingPercent ?? 30,
    originalMessageCount: originalMessages.length, selectedTextBytesBefore: 0, selectedTextBytesAfter: 0,
    estimatedTokensBefore: 0, estimatedTokensAfter: 0, estimatedSavingPercent: 0,
    estimator: "utf16-length-divided-by-four", modelQuality: "not-evaluated", recovery: "not-applied", targets: [],
  };
  const keepOriginal = (reason: string) => { report.reason = reason; reports.set(request, report); };
  if (selection.profile === "off") return keepOriginal("control");
  if (config.codecEnabled !== true) return keepOriginal("disabled");
  const sources: string[] = [];
  for (const target of selection.targets) {
    const message = originalMessages[target.messageIndex];
    const part = target.partIndex !== undefined && Array.isArray(message?.content) ? message.content[target.partIndex] : null;
    const content = target.partIndex === undefined ? message?.content
      : part?.type === "text" ? part.text : null;
    if (typeof content !== "string" || hash(content) !== target.contentSha256) return keepOriginal("target_changed");
    sources.push(content);
  }
  const beforeBytes = sources.reduce((sum, value) => sum + Buffer.byteLength(value, "utf8"), 0);
  const beforeEstimate = sources.reduce((sum, value) => sum + estimateContextTokens(value), 0);
  report.selectedTextBytesBefore = report.selectedTextBytesAfter = beforeBytes;
  report.estimatedTokensBefore = report.estimatedTokensAfter = beforeEstimate;
  if (beforeBytes > 1024 * 1024) return keepOriginal("selected_data_too_large");
  try {
    const encoded = sources.map((source) => encodeContextData(source, selection.profile));
    // Keep the integration verifier separate from the encoder's own check.
    for (let index = 0; index < sources.length; index++) {
      if (!isDeepStrictEqual(parseContextJson(sources[index]), decodeContextData(encoded[index].text, selection.profile))) {
        return keepOriginal("fact_recovery_failed");
      }
    }
    const afterBytes = encoded.reduce((sum, value) => sum + Buffer.byteLength(value.text, "utf8"), 0);
    const afterEstimate = encoded.reduce((sum, value) => sum + estimateContextTokens(value.text), 0);
    const estimatedSaving = beforeEstimate === 0 ? 0 : 100 * (beforeEstimate - afterEstimate) / beforeEstimate;
    if (afterBytes >= beforeBytes || afterEstimate >= beforeEstimate || estimatedSaving < (config.codecMinEstimatedSavingPercent ?? 30)) {
      return keepOriginal("estimated_benefit_below_threshold");
    }
    const messages = originalMessages.slice();
    for (let index = 0; index < selection.targets.length; index++) {
      const target = selection.targets[index], message = messages[target.messageIndex];
      if (target.partIndex === undefined) messages[target.messageIndex] = { ...message, content: encoded[index].text };
      else {
        const content = (message.content as MessageContentPart[]).slice(), part = content[target.partIndex];
        if (part?.type !== "text") return keepOriginal("message_graph_changed");
        content[target.partIndex] = { ...part, text: encoded[index].text };
        messages[target.messageIndex] = { ...message, content };
      }
    }
    // After verifying the encoded data, restore only the selected texts to check the complete message graph.
    const recovered = messages.map((message) => ({ ...message, content: Array.isArray(message.content) ? message.content.map((part) => ({ ...part })) : message.content }));
    for (let index = 0; index < selection.targets.length; index++) {
      const target = selection.targets[index];
      if (target.partIndex === undefined) recovered[target.messageIndex].content = sources[index];
      else {
        const parts = recovered[target.messageIndex].content as MessageContentPart[], part = parts[target.partIndex];
        if (part?.type !== "text") return keepOriginal("message_graph_changed");
        part.text = sources[index];
      }
    }
    if (!isDeepStrictEqual(recovered, originalMessages)) return keepOriginal("message_graph_changed");
    Object.assign(report, { status: "applied", reason: "verified", recovery: "exact-json-data", selectedTextBytesAfter: afterBytes,
      estimatedTokensAfter: afterEstimate, estimatedSavingPercent: Math.round(estimatedSaving * 100) / 100,
      providerInputHash: inputHash(request, messages), targets: selection.targets.map((target, index) => ({
        messageIndex: target.messageIndex, ...(target.partIndex === undefined ? {} : { partIndex: target.partIndex }),
        sourceTextHash: target.contentSha256, encodedTextHash: hash(encoded[index].text),
        sourceDataHash: encoded[index].sourceDataHash, factCount: encoded[index].factCount,
      })) });
    request.messages = messages;
    reports.set(request, report);
  } catch (error) {
    keepOriginal(typeof (error as any)?.code === "string" && (error as any).code.startsWith("CONTEXT_CODEC_")
      ? (error as any).code : "encoding_failed");
  }
}
