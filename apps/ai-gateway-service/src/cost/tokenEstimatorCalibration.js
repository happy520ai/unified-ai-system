import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { estimateTokens } from "./tokenEstimator.js";

export const TOKEN_ESTIMATOR_CALIBRATION_PHASE = "272A-token-estimator-calibration";
export const TOKEN_ESTIMATOR_CALIBRATION_CONCLUSION = "mimo-token-estimator-calibration-preview-ready";
export const CALIBRATION_PROVIDER = "mimo";
export const CALIBRATION_MODEL = "mimo-v2.5-pro";
export const CALIBRATION_COVERAGE = "smoke-only-limited";
export const CALIBRATION_CONFIDENCE = "low";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
export const PHASE_269_EVIDENCE_RELATIVE_PATH = "apps/ai-gateway-service/evidence/phase-269a-mimo-paid-api-safe-smoke.json";
export const PHASE_271_EVIDENCE_RELATIVE_PATH = "apps/ai-gateway-service/evidence/phase-271a-mimo-model-id-discovery.json";
export const PHASE_272_EVIDENCE_RELATIVE_PATH = "apps/ai-gateway-service/evidence/phase-272a-token-estimator-calibration.json";
export const PHASE_272_EVIDENCE_MD_RELATIVE_PATH = "apps/ai-gateway-service/evidence/phase-272a-token-estimator-calibration.md";

const SOURCE_EVIDENCE = [
  PHASE_269_EVIDENCE_RELATIVE_PATH,
  PHASE_271_EVIDENCE_RELATIVE_PATH,
];

export function buildTokenEstimatorCalibrationEvidence(options = {}) {
  const root = options.repoRoot ?? repoRoot;
  const sourceRecords = readSourceEvidence(root);
  const samples = sourceRecords.map(createCalibrationSample);
  const comparedSamples = samples.map(compareEstimateWithActual);
  const summary = summarizeSamples(comparedSamples);
  const calibrationProfile = createCalibrationProfile(comparedSamples);

  return {
    phase: TOKEN_ESTIMATOR_CALIBRATION_PHASE,
    status: "passed",
    conclusion: TOKEN_ESTIMATOR_CALIBRATION_CONCLUSION,
    generatedAt: new Date().toISOString(),
    provider: CALIBRATION_PROVIDER,
    model: CALIBRATION_MODEL,
    sourceEvidence: SOURCE_EVIDENCE,
    paidApiCallCount: 0,
    externalApiCalled: false,
    sampleCount: comparedSamples.length,
    calibrationCoverage: CALIBRATION_COVERAGE,
    confidence: CALIBRATION_CONFIDENCE,
    samples: comparedSamples,
    summary,
    calibrationProfile,
    tokenCostGuardFeedback: {
      calibrationProfileGenerated: true,
      calibrationAvailable: true,
      referencedByTokenCostGuardPreview: true,
      autoAppliedToProductionCalls: false,
      previewOnly: true,
      defaultNvidiaChatLaneChanged: false,
      mimoSetAsDefault: false,
    },
    safety: createSafetySummary(),
  };
}

export function readLatestMimoTokenCalibrationProfile(options = {}) {
  const evidencePath = resolve(options.repoRoot ?? repoRoot, PHASE_272_EVIDENCE_RELATIVE_PATH);
  if (!existsSync(evidencePath)) {
    return createUnavailableCalibrationProfile("phase-272a-calibration-evidence-not-found");
  }

  try {
    const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
    const profile = evidence.calibrationProfile ?? {};
    const providerMatches = (options.provider ?? CALIBRATION_PROVIDER) === profile.appliesToProvider;
    const modelMatches = (options.model ?? CALIBRATION_MODEL) === profile.appliesToModel;

    if (evidence.status !== "passed" || !providerMatches || !modelMatches) {
      return createUnavailableCalibrationProfile("calibration-profile-not-applicable");
    }

    return {
      calibrationAvailable: true,
      provider: profile.appliesToProvider,
      model: profile.appliesToModel,
      sampleCount: evidence.sampleCount,
      calibrationCoverage: evidence.calibrationCoverage,
      confidence: evidence.confidence,
      recommendedInputSafetyMultiplier: profile.recommendedInputSafetyMultiplier,
      recommendedOutputSafetyMultiplier: profile.recommendedOutputSafetyMultiplier,
      recommendedTotalSafetyMultiplier: profile.recommendedTotalSafetyMultiplier,
      recommendedMinimumInputTokenFloor: profile.recommendedMinimumInputTokenFloor,
      recommendedMinimumTotalTokenFloor: profile.recommendedMinimumTotalTokenFloor,
      autoAppliedToProductionCalls: false,
      previewOnly: true,
      evidencePath: PHASE_272_EVIDENCE_RELATIVE_PATH,
    };
  } catch {
    return createUnavailableCalibrationProfile("calibration-profile-unreadable");
  }
}

export function renderTokenEstimatorCalibrationMarkdown(evidence) {
  const tableRows = evidence.samples.map((sample) => (
    `| ${sample.sourcePhase} | ${sample.estimateInputSource} | ${sample.estimatedInputTokens} | ${sample.actualInputTokens} | ${sample.inputTokenError} | ${sample.inputTokenErrorRatio} | ${sample.estimatedOutputTokens} | ${sample.actualOutputTokens} | ${sample.outputTokenError} | ${sample.outputTokenErrorRatio} | ${sample.estimatedTotalTokens} | ${sample.actualTotalTokens} | ${sample.totalTokenError} | ${sample.totalTokenErrorRatio} | ${sample.estimatorBias} |`
  )).join("\n");

  return `# Phase 272A Token Estimator Calibration Evidence

## Goal

Calibrate the local token estimator preview against existing MiMo usage evidence only.

## Source Evidence

- ${PHASE_269_EVIDENCE_RELATIVE_PATH}
- ${PHASE_271_EVIDENCE_RELATIVE_PATH}

## Safety

- New paid API calls made by this phase: ${evidence.paidApiCallCount}
- External API called by this phase: ${evidence.externalApiCalled}
- Default NVIDIA /chat lane changed: ${evidence.safety.defaultNvidiaChatLaneChanged}
- MiMo set as default: ${evidence.safety.mimoSetAsDefault}
- Plaintext API key written: ${evidence.safety.plainTextApiKeyWritten}

## Estimate vs Actual

The original smoke prompts are not stored verbatim in the source evidence, so the estimator input is marked as reconstructed smoke metadata. Coverage is limited and must not be treated as full prompt-level calibration.

| sourcePhase | estimateInputSource | est input | actual input | input error | input error ratio | est output | actual output | output error | output error ratio | est total | actual total | total error | total error ratio | bias |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${tableRows}

## Calibration Profile

- provider: ${evidence.provider}
- model: ${evidence.model}
- sampleCount: ${evidence.sampleCount}
- calibrationCoverage: ${evidence.calibrationCoverage}
- confidence: ${evidence.confidence}
- recommendedInputSafetyMultiplier: ${evidence.calibrationProfile.recommendedInputSafetyMultiplier}
- recommendedOutputSafetyMultiplier: ${evidence.calibrationProfile.recommendedOutputSafetyMultiplier}
- recommendedTotalSafetyMultiplier: ${evidence.calibrationProfile.recommendedTotalSafetyMultiplier}
- recommendedMinimumInputTokenFloor: ${evidence.calibrationProfile.recommendedMinimumInputTokenFloor}
- recommendedMinimumTotalTokenFloor: ${evidence.calibrationProfile.recommendedMinimumTotalTokenFloor}
- autoAppliedToProductionCalls: ${evidence.calibrationProfile.autoAppliedToProductionCalls}
- previewOnly: ${evidence.calibrationProfile.previewOnly}

## Current Limits

Only two tiny smoke samples are available. They show a large MiMo input-token floor in the provider usage, but they do not prove accuracy for long context, ordinary chat, RAG answers, streaming, tool calls, or production billing.

## Next Steps

1. Keep this profile as preview metadata only.
2. Use the token floor as a guardrail when estimating tiny MiMo requests.
3. Add more calibration only after explicit approval and with a tiny request budget.
4. Compare against selected-context RAG prompts before any broader paid-provider use.
`;
}

function readSourceEvidence(root) {
  return SOURCE_EVIDENCE.map((relativePath) => {
    const absolutePath = resolve(root, relativePath);
    if (!existsSync(absolutePath)) {
      throw new Error(`Source evidence missing: ${relativePath}`);
    }

    const evidence = JSON.parse(readFileSync(absolutePath, "utf8"));
    if (evidence.status !== "passed") {
      throw new Error(`Source evidence is not passed: ${relativePath}`);
    }

    return {
      relativePath,
      evidence,
    };
  });
}

function createCalibrationSample(record) {
  if (record.relativePath === PHASE_269_EVIDENCE_RELATIVE_PATH) {
    return createPhase269Sample(record.evidence);
  }

  if (record.relativePath === PHASE_271_EVIDENCE_RELATIVE_PATH) {
    return createPhase271Sample(record.evidence);
  }

  throw new Error(`Unsupported calibration source evidence: ${record.relativePath}`);
}

function createPhase269Sample(evidence) {
  const usage = evidence.response ?? {};
  assertNumericUsage(usage, "269A");
  if (usage.success !== true || usage.textReceived !== true) {
    throw new Error("269A evidence does not contain a successful MiMo smoke response.");
  }

  return {
    sourcePhase: "269A",
    sourceEvidencePath: PHASE_269_EVIDENCE_RELATIVE_PATH,
    provider: evidence.provider ?? CALIBRATION_PROVIDER,
    model: usage.selectedModel ?? evidence.model ?? CALIBRATION_MODEL,
    estimateInputSource: "reconstructed-smoke-metadata",
    calibrationCoverage: CALIBRATION_COVERAGE,
    reconstructedPrompt: reconstructPromptFromMetadata({
      knownPrompt: "Reply with exactly: MIMO_SMOKE_OK",
      promptLength: evidence.request?.promptLength,
    }),
    maxOutputTokens: Number(evidence.request?.maxOutputTokens ?? usage.outputTokens),
    actualInputTokens: Number(usage.inputTokens),
    actualOutputTokens: Number(usage.outputTokens),
    actualTotalTokens: Number(usage.totalTokens),
    smokeSuccess: usage.success === true,
    longContextSent: evidence.request?.longContextSent === true || evidence.safety?.longContextSent === true,
    sourcePaidApiCallCount: Number(evidence.request?.paidCallAttemptLimit ?? 1),
  };
}

function createPhase271Sample(evidence) {
  const usage = evidence.smoke ?? {};
  assertNumericUsage(usage, "271A");
  if (usage.success !== true || usage.textReceived !== true) {
    throw new Error("271A evidence does not contain a successful MiMo discovery smoke response.");
  }

  return {
    sourcePhase: "271A",
    sourceEvidencePath: PHASE_271_EVIDENCE_RELATIVE_PATH,
    provider: evidence.provider ?? CALIBRATION_PROVIDER,
    model: evidence.configuration?.discoveredWorkingModelId ?? CALIBRATION_MODEL,
    estimateInputSource: "reconstructed-smoke-metadata",
    calibrationCoverage: CALIBRATION_COVERAGE,
    reconstructedPrompt: "Say MIMO_SMOKE_OK",
    maxOutputTokens: Number(usage.maxOutputTokens ?? usage.outputTokens),
    actualInputTokens: Number(usage.inputTokens),
    actualOutputTokens: Number(usage.outputTokens),
    actualTotalTokens: Number(usage.totalTokens),
    smokeSuccess: usage.success === true,
    longContextSent: evidence.safety?.longContextSentToPaidApi === true || usage.longContextSent === true,
    sourcePaidApiCallCount: Number(usage.paidApiCallCount ?? 0),
  };
}

function compareEstimateWithActual(sample) {
  const estimate = estimateTokens({
    messages: [
      {
        role: "user",
        content: sample.reconstructedPrompt,
      },
    ],
    maxOutputTokens: sample.maxOutputTokens,
  });

  const estimatedInputTokens = estimate.estimatedInputTokens;
  const estimatedOutputTokens = estimate.estimatedOutputTokens;
  const estimatedTotalTokens = estimate.estimatedTotalTokens;
  const inputTokenError = estimatedInputTokens - sample.actualInputTokens;
  const outputTokenError = estimatedOutputTokens - sample.actualOutputTokens;
  const totalTokenError = estimatedTotalTokens - sample.actualTotalTokens;

  return {
    sourcePhase: sample.sourcePhase,
    sourceEvidencePath: sample.sourceEvidencePath,
    provider: sample.provider,
    model: sample.model,
    estimateInputSource: sample.estimateInputSource,
    calibrationCoverage: sample.calibrationCoverage,
    estimatedInputTokens,
    actualInputTokens: sample.actualInputTokens,
    inputTokenError,
    inputTokenErrorRatio: ratio(inputTokenError, sample.actualInputTokens),
    estimatedOutputTokens,
    actualOutputTokens: sample.actualOutputTokens,
    outputTokenError,
    outputTokenErrorRatio: ratio(outputTokenError, sample.actualOutputTokens),
    estimatedTotalTokens,
    actualTotalTokens: sample.actualTotalTokens,
    totalTokenError,
    totalTokenErrorRatio: ratio(totalTokenError, sample.actualTotalTokens),
    estimatorBias: classifyBias([inputTokenError, outputTokenError, totalTokenError]),
    maxOutputTokens: sample.maxOutputTokens,
    smokeSuccess: sample.smokeSuccess,
    longContextSent: sample.longContextSent,
    sourcePaidApiCallCount: sample.sourcePaidApiCallCount,
    estimatorMethod: estimate.method,
    estimatorConfidence: estimate.confidence,
  };
}

function summarizeSamples(samples) {
  return {
    averageInputTokenErrorRatio: average(samples.map((sample) => sample.inputTokenErrorRatio)),
    averageOutputTokenErrorRatio: average(samples.map((sample) => sample.outputTokenErrorRatio)),
    averageTotalTokenErrorRatio: average(samples.map((sample) => sample.totalTokenErrorRatio)),
    averageAbsoluteInputTokenErrorRatio: average(samples.map((sample) => Math.abs(sample.inputTokenErrorRatio))),
    averageAbsoluteOutputTokenErrorRatio: average(samples.map((sample) => Math.abs(sample.outputTokenErrorRatio))),
    averageAbsoluteTotalTokenErrorRatio: average(samples.map((sample) => Math.abs(sample.totalTokenErrorRatio))),
    maxUnderEstimateRatio: round(Math.max(...samples.flatMap((sample) => [
      underEstimateRatio(sample.estimatedInputTokens, sample.actualInputTokens),
      underEstimateRatio(sample.estimatedOutputTokens, sample.actualOutputTokens),
      underEstimateRatio(sample.estimatedTotalTokens, sample.actualTotalTokens),
    ]))),
    maxOverEstimateRatio: round(Math.max(0, ...samples.flatMap((sample) => [
      overEstimateRatio(sample.estimatedInputTokens, sample.actualInputTokens),
      overEstimateRatio(sample.estimatedOutputTokens, sample.actualOutputTokens),
      overEstimateRatio(sample.estimatedTotalTokens, sample.actualTotalTokens),
    ]))),
    estimatorBias: classifyOverallBias(samples.map((sample) => sample.totalTokenError)),
  };
}

function createCalibrationProfile(samples) {
  const inputRatio = Math.max(...samples.map((sample) => underEstimateRatio(sample.estimatedInputTokens, sample.actualInputTokens)));
  const outputRatio = Math.max(...samples.map((sample) => underEstimateRatio(sample.estimatedOutputTokens, sample.actualOutputTokens)));
  const totalRatio = Math.max(...samples.map((sample) => underEstimateRatio(sample.estimatedTotalTokens, sample.actualTotalTokens)));
  const inputActuals = samples.map((sample) => sample.actualInputTokens);
  const totalActuals = samples.map((sample) => sample.actualTotalTokens);

  return {
    provider: CALIBRATION_PROVIDER,
    model: CALIBRATION_MODEL,
    sampleCount: samples.length,
    calibrationCoverage: CALIBRATION_COVERAGE,
    recommendedInputSafetyMultiplier: conservativeMultiplier(inputRatio),
    recommendedOutputSafetyMultiplier: conservativeMultiplier(outputRatio),
    recommendedTotalSafetyMultiplier: conservativeMultiplier(totalRatio),
    recommendedMinimumInputTokenFloor: Math.min(...inputActuals),
    recommendedMinimumTotalTokenFloor: Math.min(...totalActuals),
    appliesToProvider: CALIBRATION_PROVIDER,
    appliesToModel: CALIBRATION_MODEL,
    confidence: CALIBRATION_CONFIDENCE,
    reason: "Only two tiny smoke samples are available; no long-context or production request calibration was performed.",
    autoAppliedToProductionCalls: false,
    previewOnly: true,
  };
}

function createUnavailableCalibrationProfile(reason) {
  return {
    calibrationAvailable: false,
    reason,
    provider: CALIBRATION_PROVIDER,
    model: CALIBRATION_MODEL,
    autoAppliedToProductionCalls: false,
    previewOnly: true,
  };
}

function createSafetySummary() {
  return {
    plainTextApiKeyWritten: false,
    apiKeyPrinted: false,
    paidApiCallExecuted: false,
    externalApiCalled: false,
    defaultNvidiaChatLaneChanged: false,
    mimoSetAsDefault: false,
    longContextSentToPaidApi: false,
    largeOutputRequested: false,
    stressTestExecuted: false,
    legacyModified: false,
    projectContextCreated: false,
    codexCliInvoked: false,
    codexExecInvoked: false,
    workflowRunnerEnabled: false,
    worktreeCreated: false,
    autoCommit: false,
    autoPush: false,
  };
}

function assertNumericUsage(value, sourcePhase) {
  for (const field of ["inputTokens", "outputTokens", "totalTokens"]) {
    if (!Number.isFinite(Number(value?.[field]))) {
      throw new Error(`${sourcePhase} evidence is missing numeric ${field}.`);
    }
  }
}

function reconstructPromptFromMetadata({ knownPrompt, promptLength }) {
  if (!Number.isFinite(Number(promptLength)) || String(knownPrompt).length === Number(promptLength)) {
    return knownPrompt;
  }

  return "x".repeat(Math.max(1, Number(promptLength)));
}

function classifyBias(errors) {
  const under = errors.some((error) => error < 0);
  const over = errors.some((error) => error > 0);
  if (under && over) return "mixed";
  if (under) return "under_estimate";
  if (over) return "over_estimate";
  return "close";
}

function classifyOverallBias(errors) {
  const underCount = errors.filter((error) => error < 0).length;
  const overCount = errors.filter((error) => error > 0).length;
  if (underCount && overCount) return "mixed";
  if (underCount) return "under_estimate";
  if (overCount) return "over_estimate";
  return "close";
}

function underEstimateRatio(estimated, actual) {
  const estimateValue = Number(estimated);
  const actualValue = Number(actual);
  if (estimateValue <= 0 || actualValue <= estimateValue) return 1;
  return actualValue / estimateValue;
}

function overEstimateRatio(estimated, actual) {
  const estimateValue = Number(estimated);
  const actualValue = Number(actual);
  if (actualValue <= 0 || estimateValue <= actualValue) return 0;
  return estimateValue / actualValue;
}

function conservativeMultiplier(value) {
  return round(Math.max(1.1, Number(value || 1) * 1.1), 2);
}

function ratio(numerator, denominator) {
  if (!Number.isFinite(Number(denominator)) || Number(denominator) === 0) return 0;
  return round(Number(numerator) / Number(denominator), 4);
}

function average(values) {
  if (!values.length) return 0;
  return round(values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length, 4);
}

function round(value, digits = 4) {
  return Number((Number(value) || 0).toFixed(digits));
}
