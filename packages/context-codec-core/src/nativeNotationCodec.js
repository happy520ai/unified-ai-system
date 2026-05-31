import { encodeCompactTrace } from "./compactTraceCodec.js";
import {
  CONTEXT_CODEC_FORMATS,
  CONTEXT_CODEC_VERSION,
  DEFAULT_CONTEXT_CODEC_POLICY,
  normalizeCodecFormat,
} from "./contextCodecPolicy.js";
import { validateFactRecovery } from "./factRecoveryValidator.js";
import { encodeJsonlFacts } from "./jsonlFactCodec.js";
import { buildPointerLedger } from "./pointerLedger.js";
import { guardSecretLikeValues } from "./secretLikeGuard.js";
import { estimateTokenSaving } from "./tokenEstimator.js";
import { validateSafetyBoundary } from "./safetyBoundaryValidator.js";
import { encodeYamlState } from "./yamlStateCodec.js";

function compactMissionState(missionState = {}) {
  return {
    mission: missionState.mission ?? "unspecified",
    recommendedMode: missionState.recommendedMode ?? missionState.mode ?? "normal",
    noProviderCall: missionState.noProviderCall !== false,
  };
}

export function buildContextFacts(input) {
  const missionState = compactMissionState(input.missionState);
  const requiredFacts = Array.isArray(input.requiredFacts) ? input.requiredFacts : [];
  const baseFacts = [
    { key: "phase", value: "Phase641R-AIO", required: true },
    { key: "requestId", value: input.requestId ?? "unknown", required: true },
    { key: "source", value: input.source ?? "fixture", required: true },
    { key: "mode", value: input.mode ?? "normal", required: true },
    { key: "mission", value: missionState.mission, required: true },
    { key: "recommendedMode", value: missionState.recommendedMode, required: true },
    { key: "noProviderCall", value: String(missionState.noProviderCall), required: true },
    { key: "providerRef", value: input.providerRef ?? "none", required: true },
    { key: "credentialRef", value: input.credentialRef ?? "credentialRef:unavailable", required: true },
    {
      key: "providerCallsAllowed",
      value: String(input.safetyBoundary?.providerCallsAllowed === true),
      required: true,
    },
    {
      key: "secretReadAllowed",
      value: String(
        input.safetyBoundary?.secretReadAllowed === true ||
          input.safetyBoundary?.secretAccessAllowed === true,
      ),
      required: true,
    },
    { key: "secretRead", value: "false", required: true },
    { key: "secretLikeRejected", value: String(input.secretLikeRejected === true), required: true },
    ...(input.secretLikeRejected === true
      ? [{ key: "secretLikeValue", value: "[REDACTED_SECRET]", required: true }]
      : []),
    { key: "providerCallsMade", value: "false", required: true },
    { key: "deployExecuted", value: "false", required: true },
    { key: "chatBehaviorChanged", value: "false", required: true },
    { key: "chatGatewayExecuteBehaviorChanged", value: "false", required: true },
    { key: "evidenceRefs", value: input.evidenceRefs ?? [], required: true },
  ];
  return [
    ...baseFacts,
    ...requiredFacts.map((fact) => ({
      key: fact.key ?? fact.k ?? "requiredFact",
      value: fact.value ?? fact.v ?? "",
      required: fact.required !== false,
    })),
  ];
}

function buildState(input, facts, pointerLedger) {
  const missionState = compactMissionState(input.missionState);
  return {
    phase: "Phase641R-AIO",
    src: input.source ?? "fixture",
    mode: input.mode ?? "normal",
    codecVersion: CONTEXT_CODEC_VERSION,
    requestId: input.requestId ?? "unknown",
    bound: {
      provider: "no-call",
      secret: "no-read",
      deploy: "no",
      chat: "no-change",
      execute: "no-change",
      codexConfig: "no-change",
    },
    facts: [
      { k: "current_goal", v: "context-codec-shared-integration" },
      { k: "mission", v: missionState.mission },
      { k: "recommendedMode", v: missionState.recommendedMode },
      { k: "noProviderCall", v: missionState.noProviderCall },
      ...facts.map((fact) => ({
        k: fact.key,
        v: Array.isArray(fact.value) ? fact.value.join("|") : fact.value,
      })),
    ],
    ptr: {
      evidence: pointerLedger.pointers
        .filter((pointer) => pointer.kind === "evidence")
        .map((pointer) => pointer.ref),
      docs: pointerLedger.pointers
        .filter((pointer) => pointer.kind === "docs")
        .map((pointer) => pointer.ref),
      files: pointerLedger.pointers
        .filter((pointer) => pointer.kind === "file")
        .map((pointer) => pointer.ref),
    },
  };
}

function encodeByFormat(format, state, facts) {
  if (format === CONTEXT_CODEC_FORMATS.JSONL_FACTS) {
    return encodeJsonlFacts(facts);
  }
  if (format === CONTEXT_CODEC_FORMATS.COMPACT_TRACE) {
    return encodeCompactTrace(facts);
  }
  return encodeYamlState(state);
}

export function buildNativeNotationContext(input, options = {}) {
  const policy = options.policy ?? DEFAULT_CONTEXT_CODEC_POLICY;
  const format = normalizeCodecFormat(options.format ?? policy.defaultFormat, policy);
  const guarded = guardSecretLikeValues(input ?? {});
  const sanitizedInput = { ...guarded.value, secretLikeRejected: guarded.secretLikeRejected };
  const facts = buildContextFacts(sanitizedInput);
  const pointerLedger = buildPointerLedger(
    sanitizedInput.evidenceRefs,
    sanitizedInput.docsRefs,
    sanitizedInput.fileRefs,
  );
  const state = buildState(sanitizedInput, facts, pointerLedger);
  const formats = {
    [CONTEXT_CODEC_FORMATS.YAML_STATE]: encodeByFormat(CONTEXT_CODEC_FORMATS.YAML_STATE, state, facts),
    [CONTEXT_CODEC_FORMATS.JSONL_FACTS]: encodeByFormat(CONTEXT_CODEC_FORMATS.JSONL_FACTS, state, facts),
    [CONTEXT_CODEC_FORMATS.COMPACT_TRACE]: encodeByFormat(CONTEXT_CODEC_FORMATS.COMPACT_TRACE, state, facts),
  };
  const compactContext = formats[format];
  const tokenSaving = estimateTokenSaving(JSON.stringify(guarded.value ?? {}), compactContext);
  const recovery = validateFactRecovery({ sourceFacts: facts, compactContext });
  const safety = validateSafetyBoundary({
    compactContext,
    safetyBoundary: sanitizedInput.safetyBoundary,
  });

  return {
    codecVersion: CONTEXT_CODEC_VERSION,
    source: sanitizedInput.source ?? "fixture",
    formats,
    selectedFormat: format,
    selectedDefaultFormat: policy.defaultFormat,
    format,
    compactContext,
    tokenEstimateBefore: tokenSaving.tokenEstimateBefore,
    tokenEstimateAfter: tokenSaving.tokenEstimateAfter,
    tokenSavingPercent: tokenSaving.tokenSavingPercent,
    requiredFactsTotal: recovery.requiredFactsTotal,
    requiredFactsRecovered: recovery.requiredFactsRecovered,
    factsRecovered: recovery.factsRecovered,
    factsMissing: recovery.factsMissing,
    unsupportedClaims: recovery.unsupportedClaims,
    unsupportedClaimCount: recovery.unsupportedClaims.length,
    hallucinatedFactCount: recovery.hallucinatedFactCount,
    factRecoveryAccuracy: recovery.factRecoveryAccuracy,
    safetyBoundaryPreserved: safety.safetyBoundaryPreserved,
    pointerCoverage: pointerLedger.pointerCoverage,
    secretLikeRejected: guarded.secretLikeRejected,
    providerCallsMade: false,
    secretRead: false,
    secretValueExposed: safety.secretValueExposed,
    codexConfigModified: false,
    codexBaseUrlModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    chatBehaviorChanged: false,
    chatGatewayExecuteBehaviorChanged: false,
  };
}

export function buildYamlStateContext(input, options = {}) {
  return buildNativeNotationContext(input, { ...options, format: CONTEXT_CODEC_FORMATS.YAML_STATE });
}

export function buildJsonlFactsContext(input, options = {}) {
  return buildNativeNotationContext(input, { ...options, format: CONTEXT_CODEC_FORMATS.JSONL_FACTS });
}

export function buildCompactTraceContext(input, options = {}) {
  return buildNativeNotationContext(input, { ...options, format: CONTEXT_CODEC_FORMATS.COMPACT_TRACE });
}

export function runContextCodecDryRun(input, options = {}) {
  return {
    ...buildNativeNotationContext(input, options),
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatBehaviorChanged: false,
    chatGatewayExecuteBehaviorChanged: false,
    codexConfigModified: false,
    codexBaseUrlModified: false,
  };
}
