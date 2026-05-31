import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildUnifiedModelRegistry } from "../../apps/ai-gateway-service/src/model-library/unifiedModelRegistry.js";
import { buildModelUsabilityMatrix } from "../../apps/ai-gateway-service/src/model-library/modelUsabilityMatrix.js";
import { createModelVerificationStateStore } from "../../apps/ai-gateway-service/src/model-library/modelVerificationStateStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const docsDir = path.join(repoRoot, "docs");

const INPUTS = {
  unifiedRegistry: path.join(repoRoot, "apps", "ai-gateway-service", "src", "model-library", "unifiedModelRegistry.js"),
  usabilityMatrix: path.join(repoRoot, "apps", "ai-gateway-service", "src", "model-library", "modelUsabilityMatrix.js"),
  verificationStateStore: path.join(repoRoot, "apps", "ai-gateway-service", "src", "model-library", "modelVerificationStateStore.js"),
  selectableGate: path.join(repoRoot, "apps", "ai-gateway-service", "src", "model-library", "modelSelectableGate.js"),
  capabilityBuckets: path.join(repoRoot, "apps", "ai-gateway-service", "src", "model-library", "modelCapabilityBuckets.js"),
  nvidiaCatalogDiscovery: path.join(repoRoot, "apps", "ai-gateway-service", "src", "model-library", "nvidiaCatalogDiscovery.js"),
  nvidiaProvider: path.join(repoRoot, "apps", "ai-gateway-service", "src", "providers", "nvidia", "nvidiaUnifiedClient.js"),
  chatGateway: path.join(repoRoot, "apps", "ai-gateway-service", "src", "chat-gateway"),
  phase312LibraryState: path.join(repoRoot, "apps", "ai-gateway-service", "evidence", "phase-312a-model-library-state.json"),
  phase313VerificationState: path.join(repoRoot, "apps", "ai-gateway-service", "evidence", "phase-313a-model-verification-state.json"),
  phase313UsabilityMatrix: path.join(repoRoot, "apps", "ai-gateway-service", "evidence", "phase-313a-model-usability-matrix.json"),
  phase322WorkbenchRealNvidia: path.join(repoRoot, "apps", "ai-gateway-service", "evidence", "phase-322a-workbench-chat-gateway-real-nvidia.json"),
  phase323Report: path.join(repoRoot, "docs", "phase323d11-phase323c11-execution-report.md"),
  rootPackage: path.join(repoRoot, "package.json"),
  servicePackage: path.join(repoRoot, "apps", "ai-gateway-service", "package.json"),
};

const OUTPUT_JSON = path.join(docsDir, "phase324a-nvidia-model-candidate-inventory.json");
const OUTPUT_MD = path.join(docsDir, "phase324a-nvidia-model-candidate-inventory.md");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

function summarizeItem(record) {
  return {
    modelId: record.modelId,
    displayName: record.displayName,
    capabilityBucket: record.capabilityBucket,
    verificationStatus: record.verificationStatus,
    endpointUsed: record.endpointUsed ?? record.endpointPath ?? null,
    selectable: record.selectable === true,
    directChatAllowed: record.directChatAllowed === true,
    evidenceId: record.evidenceId ?? null,
    source: record.source ?? "",
    publisher: record.publisher ?? String(record.modelId).split("/")[0] ?? "unknown",
    freeEndpoint: record.freeEndpoint === true,
    partnerEndpoint: record.partnerEndpoint === true,
    deprecatedSoon: record.deprecatedSoon === true,
    downloadableOnly: record.downloadableOnly === true,
    requiresSpecialPayload: record.requiresSpecialPayload === true,
  };
}

function toGroup(records) {
  return records.map(summarizeItem);
}

function createPriorityList(records, limit) {
  return records
    .slice()
    .sort((a, b) => {
      const aScore = scorePriorityCandidate(a);
      const bScore = scorePriorityCandidate(b);
      if (aScore !== bScore) return bScore - aScore;
      return a.modelId.localeCompare(b.modelId);
    })
    .slice(0, limit)
    .map(summarizeItem);
}

function scorePriorityCandidate(record) {
  let score = 0;
  if (String(record.modelId).startsWith("nvidia/")) score += 30;
  if (record.capabilityBucket === "reasoning_chat") score += 20;
  if (record.capabilityBucket === "chat") score += 18;
  if (record.capabilityBucket === "code") score += 16;
  if (record.freeEndpoint === true) score += 10;
  if (record.partnerEndpoint !== true) score += 8;
  if (record.downloadableOnly !== true) score += 8;
  if (record.requiresSpecialPayload !== true) score += 8;
  if (/nemotron|llama|instruct|chat|coder/i.test(record.modelId)) score += 6;
  if (/mini|nano|8b|9b|30b|49b|70b|120b/i.test(record.modelId)) score += 3;
  return score;
}

function buildMarkdown(report) {
  const lines = [];
  lines.push("# Phase324A NVIDIA Model Candidate Inventory");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push("");
  lines.push("## 当前结论");
  lines.push("");
  lines.push("- Phase324A 只做 NVIDIA 模型库扩容规划，不执行真实 smoke。");
  lines.push("- 当前 Chat 下拉仍只应显示 2 个 verified selectable models。");
  lines.push("- Phase324A 不把任何候选模型加入 Chat 下拉。");
  lines.push("- Phase324B 才允许按真实 smoke 结果扩 verified set。");
  lines.push("- 非 NVIDIA provider 不在本轮范围。");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  Object.entries(report.summary).forEach(([key, value]) => {
    lines.push(`- ${key}: ${Array.isArray(value) ? value.join(", ") : value}`);
  });
  lines.push("");
  lines.push("## 当前 verified chat models");
  lines.push("");
  report.currentVerifiedChatModels.forEach((item) => {
    lines.push(`- \`${item.modelId}\` | bucket=${item.capabilityBucket} | evidenceId=${item.evidenceId}`);
  });
  lines.push("");
  lines.push("## candidateGroups");
  lines.push("");
  Object.entries(report.candidateGroups).forEach(([name, items]) => {
    lines.push(`### ${name}`);
    lines.push("");
    lines.push(`- 数量：${items.length}`);
    lines.push("");
    items.slice(0, 20).forEach((item) => {
      lines.push(`- \`${item.modelId}\` | bucket=${item.capabilityBucket} | status=${item.verificationStatus} | evidenceId=${item.evidenceId ?? "none"}`);
    });
    if (items.length > 20) {
      lines.push(`- ... 其余 ${items.length - 20} 项见 JSON`);
    }
    lines.push("");
  });
  lines.push("## excludedGroups");
  lines.push("");
  Object.entries(report.excludedGroups).forEach(([name, items]) => {
    lines.push(`### ${name}`);
    lines.push("");
    lines.push(`- 数量：${items.length}`);
    lines.push("");
  });
  lines.push("## Phase324B smoke batch recommendation");
  lines.push("");
  lines.push(`- 第一批建议：${report.smokeBatchRecommendation.firstBatchSize}`);
  lines.push(`- 最大建议：${report.smokeBatchRecommendation.maxBatchSize}`);
  lines.push("- 第一批模型：");
  report.smokeBatchRecommendation.firstBatchModels.forEach((item) => {
    lines.push(`- \`${item.modelId}\``);
  });
  lines.push("- 第二批扩展池：");
  report.smokeBatchRecommendation.secondBatchModels.forEach((item) => {
    lines.push(`- \`${item.modelId}\``);
  });
  lines.push("");
  lines.push("## 风险");
  lines.push("");
  report.risks.forEach((risk) => lines.push(`- ${risk}`));
  lines.push("");
  lines.push("## nextPhaseInputs");
  lines.push("");
  report.nextPhaseInputs.forEach((item) => lines.push(`- ${item}`));
  lines.push("");
  return lines.join("\n");
}

async function main() {
  await mkdir(path.join(repoRoot, "tools", "phase324a"), { recursive: true });

  const [
    phase312LibraryState,
    phase313VerificationState,
    phase313UsabilityMatrix,
    phase322Evidence,
  ] = await Promise.all([
    readJson(INPUTS.phase312LibraryState),
    readJson(INPUTS.phase313VerificationState),
    readJson(INPUTS.phase313UsabilityMatrix),
    readJson(INPUTS.phase322WorkbenchRealNvidia),
  ]);

  const providerConfigured = phase312LibraryState.providerStatus?.nvidia?.keyStatus === "tested_passed";
  const verificationStore = createModelVerificationStateStore({
    storagePath: INPUTS.phase313VerificationState,
  });
  const registry = buildUnifiedModelRegistry({
    providerConfig: {
      nvidia: {
        configured: providerConfigured,
        apiKeyConfigured: providerConfigured,
      },
    },
    smokeState: phase312LibraryState.smokeState ?? {},
    taskDefaults: phase312LibraryState.taskDefaults ?? {},
  });
  const matrix = buildModelUsabilityMatrix({ registry, verificationStore });
  const records = matrix.records ?? [];

  assert(records.length > 0, "Phase324A inventory requires non-empty model records.");
  assert(matrix.summary?.smokePassedModels === 2, "Expected 2 smoke_passed models in current baseline.");
  assert(matrix.summary?.selectableModels === 2, "Expected 2 selectable models in current baseline.");

  const allNvidiaProviderSlotRecords = records.filter((record) => record.providerId === "nvidia");
  const verifiedChatModels = allNvidiaProviderSlotRecords.filter((record) => record.chatDropdownSelectable === true);
  const blockedModels = allNvidiaProviderSlotRecords.filter((record) => record.verificationStatus === "blocked");
  const deprecatedModels = allNvidiaProviderSlotRecords.filter((record) => record.verificationStatus === "deprecated" || record.capabilityBucket === "deprecated");
  const manualReviewModels = allNvidiaProviderSlotRecords.filter((record) => record.verificationStatus === "manual_review_required");
  const unknownCapabilityModels = allNvidiaProviderSlotRecords.filter((record) => record.capabilityBucket === "unknown");
  const recordsWithEvidence = allNvidiaProviderSlotRecords.filter((record) => String(record.evidenceId ?? "").trim());
  const recordsWithoutEvidence = allNvidiaProviderSlotRecords.filter((record) => !String(record.evidenceId ?? "").trim());
  const chatCapableCandidates = allNvidiaProviderSlotRecords.filter((record) => ["chat", "reasoning_chat", "code"].includes(record.capabilityBucket));
  const nonChatExcluded = allNvidiaProviderSlotRecords.filter((record) => !["chat", "reasoning_chat", "code"].includes(record.capabilityBucket));
  const excludedBlockedOrDeprecated = allNvidiaProviderSlotRecords.filter((record) => ["blocked", "deprecated", "smoke_failed", "manual_review_required"].includes(record.verificationStatus) || record.capabilityBucket === "deprecated");
  const excludedNoEvidence = allNvidiaProviderSlotRecords.filter((record) => !record.evidenceId && record.verificationStatus !== "smoke_passed");
  const manualReviewRequired = allNvidiaProviderSlotRecords.filter((record) => {
    if (record.verificationStatus === "manual_review_required") return true;
    if (record.capabilityBucket === "unknown") return true;
    return record.directChatAllowed && !record.evidenceId && !String(record.modelId).startsWith("nvidia/");
  });

  const eligibleForFutureSmoke = chatCapableCandidates.filter((record) => {
    return record.verificationStatus === "unverified"
      && record.capabilityBucket !== "unknown"
      && record.capabilityBucket !== "deprecated"
      && record.downloadableOnly !== true
      && record.requiresSpecialPayload !== true;
  });

  const nvidiaPublisherCandidates = eligibleForFutureSmoke.filter((record) => String(record.modelId).startsWith("nvidia/"));
  const providerSlotSecondary = eligibleForFutureSmoke.filter((record) => !String(record.modelId).startsWith("nvidia/"));

  const phase324bPriorityCandidates = createPriorityList(nvidiaPublisherCandidates, 5);
  const priorityIds = new Set(phase324bPriorityCandidates.map((item) => item.modelId));
  const phase324bSecondaryCandidates = createPriorityList(
    [
      ...nvidiaPublisherCandidates.filter((record) => !priorityIds.has(record.modelId)),
      ...providerSlotSecondary,
    ],
    15,
  );

  const report = {
    generatedAt: new Date().toISOString(),
    sourceFiles: [
      INPUTS.unifiedRegistry,
      INPUTS.usabilityMatrix,
      INPUTS.verificationStateStore,
      INPUTS.selectableGate,
      INPUTS.capabilityBuckets,
      INPUTS.nvidiaCatalogDiscovery,
      INPUTS.phase312LibraryState,
      INPUTS.phase313VerificationState,
      INPUTS.phase313UsabilityMatrix,
      INPUTS.phase322WorkbenchRealNvidia,
      INPUTS.phase323Report,
      INPUTS.rootPackage,
      INPUTS.servicePackage,
    ],
    summary: {
      phase313EvidenceTotalModels: phase313UsabilityMatrix.totalModels,
      staticRegistryModelCount: records.length,
      providerSlots: ["nvidia", "openai", "claude", "openrouter", "mimo", "local"],
      nvidiaOnlyRealProvider: true,
      currentVerifiedChatModelCount: verifiedChatModels.length,
      currentVerifiedChatModelIds: verifiedChatModels.map((item) => item.modelId),
      blockedCount: blockedModels.length,
      deprecatedCount: deprecatedModels.length,
      manualReviewCount: manualReviewModels.length,
      unknownCapabilityCount: unknownCapabilityModels.length,
      withEvidenceIdCount: recordsWithEvidence.length,
      withoutEvidenceIdCount: recordsWithoutEvidence.length,
      chatCapableCandidateCount: chatCapableCandidates.length,
      nonChatExcludedCount: nonChatExcluded.length,
      phase324bPriorityCandidateCount: phase324bPriorityCandidates.length,
      phase324bSecondaryCandidateCount: phase324bSecondaryCandidates.length,
    },
    currentVerifiedChatModels: toGroup(verifiedChatModels),
    nvidiaModelRecords: {
      staticRegistryRecords: toGroup(allNvidiaProviderSlotRecords),
      phase313EvidenceSummary: {
        totalModels: phase313UsabilityMatrix.totalModels,
        smokePassedModels: phase313UsabilityMatrix.smokePassedModels,
        selectableModels: phase313UsabilityMatrix.selectableModels,
        deprecatedModels: phase313UsabilityMatrix.deprecatedModels,
        blockedModels: phase313UsabilityMatrix.blockedModels,
        failedModels: phase313UsabilityMatrix.failedModels,
      },
      phase313VerificationStateRecords: Object.values(phase313VerificationState.records ?? {}),
      phase322AChainEvidence: {
        verifiedModelId: phase322Evidence.verifiedModelId,
        providerCalled: phase322Evidence.providerCalled === true,
        completionVerified: phase322Evidence.completionVerified === true,
      },
    },
    candidateGroups: {
      "current-verified-chat": toGroup(verifiedChatModels),
      "phase324b-priority-candidates": phase324bPriorityCandidates,
      "phase324b-secondary-candidates": phase324bSecondaryCandidates,
      "manual-review-required": toGroup(manualReviewRequired),
    },
    excludedGroups: {
      "excluded-not-chat": toGroup(nonChatExcluded),
      "excluded-blocked-or-deprecated": toGroup(excludedBlockedOrDeprecated),
      "excluded-no-evidence": toGroup(excludedNoEvidence),
    },
    smokeBatchRecommendation: {
      firstBatchSize: 5,
      maxBatchSize: 10,
      firstBatchModels: phase324bPriorityCandidates,
      secondBatchModels: phase324bSecondaryCandidates.slice(0, 10),
      rationale: [
        "第一批优先选 NVIDIA publisher 自有 chat/reasoning_chat 模型，避免一开始扩大到 partner catalog。",
        "优先 free endpoint、无需 special payload、非 deprecated、非 blocked、非 downloadable-only 的模型。",
        "保持第一批 5 个左右，便于观察 latency、404、schema、completionVerified 等真实 smoke 风险。",
      ],
    },
    risks: [
      "Phase313A evidence 显示 NVIDIA provider slot 下存在 148 条 catalog records，但当前静态源码可复建 records 为 104 条；两者必须在报告中区分，避免把 live discovery 合并结果当作纯源码事实。",
      "当前 verified selectable models 仍只有 2 个；Phase324A 不得把任何未 smoke 模型加入 Chat 下拉。",
      "partner catalog 中大量模型虽然挂在 NVIDIA provider slot 下，但不等于本轮应优先 smoke；Phase324B 第一批应先控制在 NVIDIA publisher 自有模型。",
      "smoke_failed 的 nvidia/llama-3.1-nemotron-ultra-253b-v1 已知 404，不应纳入第一批 priority candidate。",
    ],
    nextPhaseInputs: [
      "Phase324B 第一批建议先测 5 个 priority candidates：nvidia/llama-3.3-nemotron-super-49b-v1.5, nvidia/nemotron-3-nano-30b-a3b, nvidia/nemotron-3-super-120b-a12b, nvidia/nemotron-mini-4b-instruct, nvidia/nvidia-nemotron-nano-9b-v2",
      "Phase324B 真实 smoke 必须记录 providerCalled=true、completionVerified=true、assistantText 非空、latencyMs、httpStatus/errorCode、evidenceId",
      "Phase324C 只把 smoke_passed 且 evidence 合格的模型加入 selectable verified set",
      "Phase324D 再做模型库 UI 增强，不在 Phase324A 修改任何生产 UI 或 Chat 主链",
    ],
  };

  await writeFile(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
  await writeFile(OUTPUT_MD, `${buildMarkdown(report)}\n`, "utf-8");

  console.log("[Phase324A] NVIDIA model inventory JSON written:", OUTPUT_JSON);
  console.log("[Phase324A] NVIDIA model inventory Markdown written:", OUTPUT_MD);
  console.log(`[Phase324A] Static registry records: ${records.length}`);
  console.log(`[Phase324A] Verified chat models: ${verifiedChatModels.length}`);
}

main().catch((error) => {
  console.error("[Phase324A] Failed:", error.message);
  process.exit(1);
});
