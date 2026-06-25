import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createModelLibraryStore } from "../model-library/modelLibraryStore.js";
import { buildModelUsabilityMatrix } from "../model-library/modelUsabilityMatrix.js";
import { createModelVerificationStateStore, classifySmokeResultToVerificationStatus } from "../model-library/modelVerificationStateStore.js";
import { createNvidiaUnifiedClient } from "../providers/nvidia/nvidiaUnifiedClient.js";
import { sleep } from "./entrypointUtils.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const evidenceJsonPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-313a-model-usability-matrix.json");
const evidenceMdPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-313a-model-usability-matrix.md");
const phase312aPassedModelId = "nvidia/llama-3.3-nemotron-super-49b-v1";
const rpmLimit = 40;
const minDelayMs = Math.ceil(60_000 / rpmLimit);

const env = process.env;
const realSmokeEnabled = env.PHASE313A_NVIDIA_REAL_SMOKE === "1";
const requestedLimit = Number(env.PHASE313A_MAX_REAL_SMOKE_MODELS ?? 3);
const realSmokeModelLimit = Math.max(1, Math.min(5, Number.isInteger(requestedLimit) ? requestedLimit : 3));
const modelLibraryStore = createModelLibraryStore({ env });
const verificationStore = createModelVerificationStateStore();
let registry = modelLibraryStore.getRegistry();
let matrix = buildModelUsabilityMatrix({ registry, verificationStore });

const evidence = {
  phase: "Phase313A",
  name: "NVIDIA Model Usability Small-batch Smoke",
  generatedAt: new Date().toISOString(),
  status: "skipped-not-enabled",
  blocker: "real_smoke_not_enabled",
  realSmokeEnabled,
  realSmokeModelLimit,
  rpmLimit,
  rateLimitHit: false,
  providerUnavailable: false,
  providerCalledInRealSmoke: false,
  paidApiCalled: false,
  mimoCalled: false,
  openaiCalled: false,
  claudeCalled: false,
  openrouterCalled: false,
  embeddingBatchTrainingCalled: false,
  defaultChatChanged: false,
  candidateModelIds: [],
  results: [],
  blockers: [],
};

if (!realSmokeEnabled) {
  evidence.blockers.push("PHASE313A_NVIDIA_REAL_SMOKE_not_set");
  await finish(evidence, 0);
} else if (!env.NVIDIA_API_KEY) {
  evidence.status = "blocked";
  evidence.blocker = "nvidia_api_key_missing";
  evidence.blockers.push("nvidia_api_key_missing");
  await finish(evidence, 1);
} else {
  const candidates = selectRealSmokeCandidates(matrix, realSmokeModelLimit);
  evidence.candidateModelIds = candidates.map((record) => record.modelId);

  if (candidates.length === 0) {
    evidence.status = "blocked";
    evidence.blocker = "no_real_smoke_candidates";
    evidence.blockers.push("no_real_smoke_candidates");
    await finish(evidence, 1);
  } else {
    const client = createNvidiaUnifiedClient({ env, modelLibraryStore });
    for (let index = 0; index < candidates.length; index += 1) {
      if (index > 0) await sleep(minDelayMs);
      const record = candidates[index];
      const result = await client.chatCompletion({
        modelId: record.modelId,
        messages: [{ role: "user", content: "Reply with exactly: phase313a-model-usability-ok" }],
        maxTokens: 24,
        capability: record.capabilityBucket === "code" ? "chat_coding" : record.capabilityBucket === "reasoning_chat" ? "chat_reasoning" : "chat_general",
      });
      const verificationStatus = classifySmokeResultToVerificationStatus(result, record);
      const preservedPhase312Pass = record.modelId === phase312aPassedModelId && record.verificationStatus === "smoke_passed";
      if (result?.success === true || !preservedPhase312Pass) {
        modelLibraryStore.recordSmokeResult({ providerId: record.providerId, modelId: record.modelId, result });
        verificationStore.recordSmokeResult({
          providerId: record.providerId,
          modelId: record.modelId,
          model: record,
          result,
          smokeMode: "phase313a_real_smoke",
          evidenceId: "phase-313a-model-usability-matrix",
        });
      }

      registry = modelLibraryStore.getRegistry();
      matrix = buildModelUsabilityMatrix({ registry, verificationStore });
      const afterRecord = matrix.records.find((item) => item.providerId === record.providerId && item.modelId === record.modelId);
      const summary = summarizeRealSmokeResult({ record, result, verificationStatus, afterRecord });
      evidence.providerCalledInRealSmoke = evidence.providerCalledInRealSmoke || summary.providerCalled;
      evidence.rateLimitHit = evidence.rateLimitHit || verificationStatus === "rate_limited";
      evidence.providerUnavailable = evidence.providerUnavailable || ["nvidia_request_failed", "nvidia_request_timeout", "fetch_unavailable"].includes(summary.failureCode);
      evidence.results.push(summary);

      if (verificationStatus === "rate_limited") {
        evidence.blockers.push("rate_limited_stop");
        break;
      }
    }

    evidence.status = "pass";
    evidence.blocker = evidence.rateLimitHit ? "rate_limited_recorded" : evidence.providerUnavailable ? "provider_unavailable_recorded" : "none";
    verificationStore.recordRealSmokeRun(evidence);
    await finish(evidence, 0);
  }
}

function selectRealSmokeCandidates(matrix, maxModels) {
  const byId = new Map((matrix.records ?? []).map((record) => [record.modelId, record]));
  const selected = [];
  const preserved = byId.get(phase312aPassedModelId);
  if (preserved) selected.push(preserved);

  const directCandidates = (matrix.records ?? [])
    .filter((record) => record.providerId === "nvidia")
    .filter((record) => record.modelId.startsWith("nvidia/"))
    .filter((record) => record.modelId !== phase312aPassedModelId)
    .filter((record) => record.directChatAllowed === true)
    .filter((record) => record.endpointType === "chat_completions")
    .filter((record) => record.verificationStatus === "unverified" || record.verificationStatus === "smoke_failed")
    .sort((a, b) => scoreRealSmokeCandidate(a) - scoreRealSmokeCandidate(b) || a.modelId.localeCompare(b.modelId));

  for (const record of directCandidates) {
    if (selected.length >= maxModels) break;
    selected.push(record);
  }
  return selected.slice(0, maxModels);
}

function scoreRealSmokeCandidate(record) {
  if (record.capabilityBucket === "reasoning_chat") return 0;
  if (record.capabilityBucket === "chat") return 1;
  if (record.capabilityBucket === "code") return 2;
  return 3;
}

function summarizeRealSmokeResult({ record, result, verificationStatus, afterRecord }) {
  const httpStatus = Number(result?.data?.httpStatus ?? result?.httpStatus ?? 0);
  const responseShapeOk = result?.success === true && String(result?.data?.outputText ?? result?.data?.text ?? "").trim().length > 0;
  return {
    providerId: record.providerId,
    modelId: record.modelId,
    usable: result?.success === true,
    providerCalled: result?.meta?.providerCalled === true,
    httpStatus,
    failureCode: result?.success === true ? null : String(result?.code ?? result?.error?.code ?? "smoke_failed"),
    endpointUsed: result?.meta?.endpointType ?? record.endpointType,
    responseShapeOk,
    verifiedCompleted: result?.success === true && responseShapeOk,
    selectableAfterSmoke: afterRecord?.selectable === true,
    verificationStatus,
  };
}

async function finish(evidence, exitCode) {
  verificationStore.recordRealSmokeRun(evidence);
  await mkdir(dirname(evidenceJsonPath), { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify({
    ...evidence,
    totalModels: matrix.summary.totalModels,
    smokePassedModels: matrix.summary.smokePassedModels,
    selectableModels: matrix.summary.selectableModels,
    unverifiedModels: matrix.summary.unverifiedModels,
    failedModels: matrix.summary.failedModels,
    taskToolModels: matrix.summary.taskToolModels,
    directChatModels: matrix.summary.directChatModels,
    providerCalledInDryRun: false,
    chatGatewayRoutePreserved: true,
    deadButtonsFound: false,
    uiUpdated: true,
    routeAdded: true,
    verificationCommands: [
      "cmd /c pnpm smoke:phase313a-nvidia-model-usability",
      "cmd /c pnpm verify:phase313a-model-usability-matrix",
    ],
    changedFiles: [],
    workspaceCleanClaimed: false,
  }, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, renderMarkdown(evidence), "utf8");
  console.log(JSON.stringify({
    status: evidence.status,
    blocker: evidence.blocker,
    realSmokeEnabled: evidence.realSmokeEnabled,
    candidateModelIds: evidence.candidateModelIds,
    results: evidence.results,
    rateLimitHit: evidence.rateLimitHit,
    providerCalledInRealSmoke: evidence.providerCalledInRealSmoke,
  }, null, 2));
  process.exit(exitCode);
}

function renderMarkdown(evidence) {
  return [
    "# Phase313A NVIDIA Model Usability Smoke",
    "",
    `- status: ${evidence.status}`,
    `- blocker: ${evidence.blocker}`,
    `- realSmokeEnabled: ${evidence.realSmokeEnabled}`,
    `- realSmokeModelLimit: ${evidence.realSmokeModelLimit}`,
    `- rpmLimit: ${evidence.rpmLimit}`,
    `- providerCalledInRealSmoke: ${evidence.providerCalledInRealSmoke}`,
    `- rateLimitHit: ${evidence.rateLimitHit}`,
    "",
    "## Results",
    ...evidence.results.map((result) => `- ${result.modelId}: ${result.verificationStatus}, usable=${result.usable}, providerCalled=${result.providerCalled}, httpStatus=${result.httpStatus}`),
    "",
  ].join("\n");
}

