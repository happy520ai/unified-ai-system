import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { encodeContextData, parseContextJson, estimateContextTokens } from "@unified-ai-system/context-codec-core";
import { createGatewayClient } from "@unified-ai-system/shared-sdk";
import { readOperatorPayload, sanitizeOperatorData, type OperatorOptions, type Output } from "./operatorCommands.ts";

type Data = Record<string, any>;
const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const isObject = (value: unknown): value is Data => Boolean(value && typeof value === "object" && !Array.isArray(value));
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
function invalid(message: string): never { throw Object.assign(new Error(message), { code: "CONTEXT_CODEC_CASE_INVALID" }); }
function exact(value: unknown, required: string[], optional: string[] = []): asserts value is Data {
  if (!isObject(value) || required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => ![...required, ...optional].includes(key))) invalid("Comparison input has missing or unsupported fields.");
}

export function validateContextCodecOptions(options: OperatorOptions): void {
  if (!["preview", "compare"].includes(options.positionals[0]) || options.positionals.length !== 1 || !options.operatorInput) invalid("Use codec preview|compare --input <case.json>.");
  if (options.prompt !== null || options.agentId !== null || options.agentGoal !== null || options.operatorMode !== null
    || options.operatorSources.length || options.operatorPasses !== null || options.lifecycleLimit !== null || options.lifecycleOffset !== null) invalid("Codec accepts a case file, model selection and an output limit.");
  if (options.confirmed && options.positionals[0] !== "compare") invalid("--yes applies only to codec compare.");
  if (options.operatorMaxOutputTokens !== null && (!Number.isSafeInteger(options.operatorMaxOutputTokens) || options.operatorMaxOutputTokens < 1 || options.operatorMaxOutputTokens > 4096)) invalid("Comparison output limit must be 1–4096 per request.");
}

function prepareCase(options: OperatorOptions) {
  const input = readOperatorPayload(options.operatorInput!, parseContextJson);
  exact(input, ["request", "profile", "targets", "expectedJson"], ["minReportedInputSavingPercent"]);
  if (!["yaml_state", "jsonl_facts", "compact_trace"].includes(input.profile)) invalid("Unsupported Context Codec profile.");
  exact(input.request, ["messages"], ["providerId", "model", "options", "taskType", "context", "metadata", "tools", "toolChoice", "parallelToolCalls", "requiredCapabilities"]);
  const request = input.request;
  if (request.taskType !== undefined && request.taskType !== "chat") invalid("Comparison uses native chat requests.");
  request.taskType = "chat";
  for (const [field, flag] of [["providerId", options.agentProviderId], ["model", options.agentModelId]] as const) {
    if (flag !== null && request[field] !== undefined && request[field] !== flag) invalid("Case and command model selections conflict.");
    if (flag !== null) request[field] = flag;
  }
  request.providerId ??= "local-fake-provider"; request.model ??= "local-fake-model";
  if (![request.providerId, request.model].every(value => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u.test(value))) invalid("Use an exact providerId and model.");
  if (request.providerId !== "local-fake-provider" && !options.allowRealProvider) invalid("A non-default provider requires --allow-real-provider; compare may make two paid requests.");
  request.options ??= {};
  exact(request.options, [], ["temperature", "topP", "maxOutputTokens", "stopSequences", "responseFormat", "reasoningEffort"]);
  if (options.operatorMaxOutputTokens !== null && request.options.maxOutputTokens !== undefined && request.options.maxOutputTokens !== options.operatorMaxOutputTokens) invalid("Output limits conflict.");
  request.options.maxOutputTokens = options.operatorMaxOutputTokens ?? request.options.maxOutputTokens ?? 512;
  if (!Number.isSafeInteger(request.options.maxOutputTokens) || request.options.maxOutputTokens < 1 || request.options.maxOutputTokens > 4096) invalid("Comparison output limit must be 1–4096 per request.");
  if (!Array.isArray(request.messages) || !request.messages.length || request.messages.length > 256) invalid("Provide 1–256 messages.");
  for (const message of request.messages) {
    exact(message, ["role", "content"], ["name", "toolCallId", "toolCalls", "metadata"]);
    if (!["system", "user", "assistant", "tool"].includes(message.role)) invalid("Unsupported message role.");
  }
  if (!Array.isArray(input.targets) || !input.targets.length || input.targets.length > 16) invalid("Select 1–16 JSON data blocks.");
  const seen = new Set<string>();
  let bytesBefore = 0, bytesAfter = 0, estimatedBefore = 0, estimatedAfter = 0;
  const targetEvidence: Data[] = [];
  const targets = input.targets.map((target: unknown) => {
    exact(target, ["messageIndex"], ["partIndex"]);
    if (!count(target.messageIndex) || target.partIndex !== undefined && !count(target.partIndex)) invalid("Invalid target index.");
    const key = `${target.messageIndex}:${target.partIndex ?? "text"}`;
    if (seen.has(key)) invalid("Duplicate comparison target."); seen.add(key);
    const message = request.messages[target.messageIndex];
    const source = target.partIndex === undefined ? message?.content
      : Array.isArray(message?.content) && message.content[target.partIndex]?.type === "text" ? message.content[target.partIndex].text : null;
    if (typeof source !== "string") invalid("Select a string message or a text content part containing JSON data.");
    const encoded = encodeContextData(source, input.profile);
    bytesBefore += encoded.byteLengthBefore; bytesAfter += encoded.byteLengthAfter;
    estimatedBefore += estimateContextTokens(source); estimatedAfter += estimateContextTokens(encoded.text);
    targetEvidence.push({ ...target, sourceTextHash: sha(source), encodedTextHash: sha(encoded.text), sourceDataHash: encoded.sourceDataHash, factCount: encoded.factCount });
    return { ...target, contentSha256: sha(source) };
  });
  const minimum = input.minReportedInputSavingPercent ?? 0;
  if (typeof minimum !== "number" || !Number.isFinite(minimum) || minimum < 0 || minimum >= 100) invalid("Minimum reported input saving must be 0–100 (exclusive).");
  return { request, contextCodec: { profile: input.profile, targets }, targetEvidence, expected: input.expectedJson, minimum,
    preview: { bytesBefore, bytesAfter, estimatedTokensBefore: estimatedBefore, estimatedTokensAfter: estimatedAfter,
      estimatedSavingPercent: estimatedBefore > 0 ? 100 * (estimatedBefore - estimatedAfter) / estimatedBefore : 0,
      estimator: "utf16-length-divided-by-four", recovery: "exact-json-data", modelQuality: "not-evaluated" } };
}

function reportedUsage(data: Data): Data {
  const usage = data.metadata?.rawProviderMeta?.usageObservation;
  if (!isObject(usage) || usage.version !== 1 || usage.invalid !== false || usage.complete !== true
    || usage.inputComplete !== true || usage.outputComplete !== true || !["reported", "components"].includes(usage.source)
    || !count(usage.inputTokens) || !count(usage.outputTokens) || !count(usage.totalTokens)
    || usage.totalTokens < usage.inputTokens + usage.outputTokens) return { kind: "unavailable", input: null, output: null, total: null };
  return { kind: data.executionMode === "real" ? "provider-reported" : "synthetic", input: usage.inputTokens, output: usage.outputTokens, total: usage.totalTokens };
}

function inspectArm(result: Data, prepared: ReturnType<typeof prepareCase>, arm: "baseline" | "encoded"): Data {
  const data = result?.data, report = data?.metadata?.contextCodec;
  if (result?.success !== true || !isObject(data) || data.executionStatus !== "success"
    || data.selectedProvider !== prepared.request.providerId || data.selectedModel !== prepared.request.model
    || !["fake", "real"].includes(data.executionMode) || !isObject(report) || report.version !== "context-codec-request-v1"
    || typeof report.enabled !== "boolean" || typeof report.minEstimatedSavingPercent !== "number" || !Number.isFinite(report.minEstimatedSavingPercent)
    || report.minEstimatedSavingPercent < 0 || report.minEstimatedSavingPercent >= 100
    || ![report.inputHash, report.providerInputHash, report.policyHash].every(value => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value))
    || arm === "baseline" && (report.profile !== "off" || report.status !== "original" || report.reason !== "control" || report.inputHash !== report.providerInputHash)
    || arm === "encoded" && (report.profile !== prepared.contextCodec.profile || report.status !== "applied" || report.recovery !== "exact-json-data"
      || !isDeepStrictEqual(report.targets, prepared.targetEvidence))) {
    throw Object.assign(new Error("Gateway response does not prove the requested model and codec arm completed."), { code: "CONTEXT_CODEC_RESPONSE_UNVERIFIED" });
  }
  let answer: unknown, qualityMatched = false;
  const text = data.outputText ?? data.text;
  try { answer = parseContextJson(text); qualityMatched = isDeepStrictEqual(answer, prepared.expected); } catch { /* A malformed answer is a failed quality check. */ }
  return { requestId: data.id ?? result.meta?.requestId, mode: data.executionMode, providerId: data.selectedProvider, model: data.selectedModel,
    report, answerText: typeof text === "string" ? text : null, answerHash: typeof text === "string" ? sha(text) : null,
    qualityMatched, usage: reportedUsage(data) };
}

export async function runContextCodecCommand(options: OperatorOptions, output: Output): Promise<number> {
  const arms: Data = {}, requestReferences: Data = {};
  let phase = "preview", comparisonId: string | null = null;
  const emit = (value: Data, code: number) => {
    const projected = sanitizeOperatorData(value);
    output.write(JSON.stringify(projected, null, 2) + "\n");
    return code;
  };
  try {
    validateContextCodecOptions(options);
    const prepared = prepareCase(options);
    if (options.positionals[0] === "preview" || !options.confirmed) return emit({ ok: true, status: "preview",
      request: prepared.request, contextCodec: prepared.contextCodec, expectedJson: prepared.expected,
      localCodec: prepared.preview, maxProviderRequests: 2, maxOutputTokensPerRequest: prepared.request.options.maxOutputTokens,
      nextAction: "Review the exact case and model. codec compare with --yes performs at most two requests; this preview made none." }, 0);
    if (!options.adminKey) invalid("Comparison requires the existing gateway management authentication entry.");
    comparisonId = `codec-${randomUUID()}`;
    const client = createGatewayClient({ baseUrl: options.url, timeoutMs: options.timeoutMs, headers: { authorization: `Bearer ${options.adminKey}` } });
    for (const arm of ["baseline", "encoded"] as const) {
      phase = arm;
      const requestId = `${comparisonId}-${arm}`;
      requestReferences[arm] = { requestId, idempotencyKey: requestId };
      const result = await client.chat({ ...prepared.request, context: { ...prepared.request.context, requestId, traceId: requestId },
        contextCodec: arm === "baseline" ? { profile: "off" } : prepared.contextCodec, idempotencyKey: requestId } as any);
      arms[arm] = inspectArm(result as any, prepared, arm);
      if (arm === "baseline" && (!arms.baseline.qualityMatched || arms.baseline.report.enabled !== true
        || prepared.preview.estimatedSavingPercent < arms.baseline.report.minEstimatedSavingPercent
        || prepared.preview.bytesAfter >= prepared.preview.bytesBefore)) {
        return emit({ ok: false, status: "not_completed", reason: !arms.baseline.qualityMatched ? "baseline_quality_failed" : "codec_not_eligible",
          comparisonId, requestReferences, arms, nextAction: "Keep the baseline result. Correct the case or enable the codec before starting a new comparison; the encoded request was not sent." }, 1);
      }
    }
    const baseline = arms.baseline, encoded = arms.encoded;
    const sameInput = baseline.report.inputHash === encoded.report.inputHash && baseline.report.policyHash === encoded.report.policyHash && baseline.mode === encoded.mode;
    const qualityMatched = sameInput && baseline.qualityMatched && encoded.qualityMatched;
    const usageComparable = sameInput && baseline.usage.kind !== "unavailable" && baseline.usage.kind === encoded.usage.kind && baseline.usage.input > 0;
    const inputSavingPercent = usageComparable ? 100 * (baseline.usage.input - encoded.usage.input) / baseline.usage.input : null;
    const benefitPassed = inputSavingPercent !== null && inputSavingPercent > 0 && inputSavingPercent >= prepared.minimum;
    const passed = qualityMatched && benefitPassed;
    return emit({ ok: passed, status: passed ? baseline.mode === "fake" ? "synthetic_case_passed" : "case_passed" : "comparison_failed",
      comparisonId, requestReferences, sameInput, sameModelId: true, qualityMatched, expectedJsonHash: sha(JSON.stringify(prepared.expected)),
      usageComparable, inputSavingPercent, minimumReportedInputSavingPercent: prepared.minimum, arms,
      scope: "One explicit structured-answer case. No general model-quality, average cost, billing or production claim." }, passed ? 0 : 1);
  } catch (error) {
    const code = typeof (error as any)?.code === "string" ? (error as any).code : "CONTEXT_CODEC_COMPARISON_FAILED";
    return emit({ ok: false, status: "not_completed", phase, comparisonId, requestReferences, arms, code,
      message: error instanceof Error ? error.message.slice(0, 512) : "Comparison could not be verified.",
      providerOutcome: phase === "preview" ? "not_called" : "failed_or_unknown", automaticRetry: false,
      nextAction: phase === "preview" ? "Check the case file and supported codec profile."
        : "Keep these request IDs and existing results. Reconcile the gateway records before any new comparison; no automatic retry was made." }, 1);
  }
}
