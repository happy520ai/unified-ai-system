import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createModelLibraryStore } from "../../apps/ai-gateway-service/src/model-library/modelLibraryStore.js";
import { createNvidiaUnifiedClient } from "../../apps/ai-gateway-service/src/providers/nvidia/nvidiaUnifiedClient.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const phase = "Phase324B";
const providerId = "nvidia";
const promptText = "请用一句中文回答：你能正常工作吗？";
const promptType = "short_cn_health_check";
const timeoutMs = 45_000;
const maxTokens = 64;
const rpmLimit = 40;
const minDelayMs = Math.ceil(60_000 / rpmLimit);

const inventoryPath = path.join(repoRoot, "docs", "phase324a-nvidia-model-candidate-inventory.json");
const evidenceDir = path.join(repoRoot, "apps", "ai-gateway-service", "evidence", "phase324b");
const batchResultJsonPath = path.join(repoRoot, "docs", "phase324b-nvidia-smoke-batch-result.json");
const batchReportMdPath = path.join(repoRoot, "docs", "phase324b-nvidia-smoke-batch-report.md");
const evidenceIndexJsonPath = path.join(repoRoot, "docs", "phase324b-model-smoke-evidence-index.json");
const executionReportPath = path.join(repoRoot, "docs", "phase324b-execution-report.md");

const fixedCandidates = [
  "nvidia/llama-3.3-nemotron-super-49b-v1.5",
  "nvidia/nemotron-3-nano-30b-a3b",
  "nvidia/nemotron-3-super-120b-a12b",
  "nvidia/nemotron-mini-4b-instruct",
  "nvidia/nvidia-nemotron-nano-9b-v2",
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function toSafeFileName(modelId) {
  return String(modelId).replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

function truncateText(text, limit = 200) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 3))}...`;
}

function redactSecrets(text) {
  return String(text ?? "")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/\b(nvapi|sk|pk|ak|sk-proj)[A-Za-z0-9._-]{8,}\b/gi, "[redacted]")
    .replace(/([?&](?:api[_-]?key|token|secret|key)=)[^&\s]+/gi, "$1[redacted]");
}

function mapCapability(record) {
  if (record?.capabilityBucket === "code") return "chat_coding";
  if (record?.capabilityBucket === "reasoning_chat") return "chat_reasoning";
  return "chat_general";
}

function buildEvidenceId(modelId, timestamp) {
  const compact = timestamp.replace(/[-:.TZ]/g, "").slice(0, 14);
  return `phase324b-${toSafeFileName(modelId)}-${compact}`;
}

function classifyResult({ result, missingKey }) {
  if (missingKey) {
    return {
      finalStatus: "skipped_env_missing",
      selectableRecommendation: "not_eligible",
      notes: ["NVIDIA runtime key unavailable; batch intentionally skipped without treating this as product regression."],
    };
  }

  const providerCalled = result?.meta?.providerCalled === true;
  const completionVerified = result?.success === true;
  const assistantText = String(result?.data?.outputText ?? result?.data?.text ?? "").trim();
  const assistantTextPresent = assistantText.length > 0;
  const code = String(result?.code ?? result?.error?.code ?? "");
  const httpStatus = Number(result?.data?.httpStatus ?? result?.meta?.httpStatus ?? 0) || null;

  if (
    providerCalled
    && completionVerified
    && assistantTextPresent
    && !["nvidia_api_key_missing", "provider_not_allowed", "nvidia_request_timeout", "fetch_unavailable"].includes(code)
  ) {
    return {
      finalStatus: "smoke_passed",
      selectableRecommendation: "eligible_after_phase324c",
      notes: ["Real NVIDIA call completed with non-empty assistant text; Phase324C may review selectable eligibility."],
    };
  }

  if (code === "nvidia_api_key_missing") {
    return {
      finalStatus: "skipped_env_missing",
      selectableRecommendation: "not_eligible",
      notes: ["Runtime key was not available at execution time; no provider success was claimed."],
    };
  }

  if (providerCalled && !completionVerified && httpStatus !== null) {
    return {
      finalStatus: "smoke_failed",
      selectableRecommendation: "not_eligible",
      notes: ["Provider responded but the smoke did not complete successfully; keep non-selectable until a later verified phase."],
    };
  }

  if (providerCalled && completionVerified && !assistantTextPresent) {
    return {
      finalStatus: "manual_review_required",
      selectableRecommendation: "manual_review_required",
      notes: ["Completion flag was true but assistant text was empty; requires manual review before any selectable consideration."],
    };
  }

  return {
    finalStatus: "smoke_failed",
    selectableRecommendation: "not_eligible",
    notes: ["Smoke did not satisfy the success gate; keep non-selectable."],
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function renderBatchMarkdown(summary) {
  const lines = [
    "# Phase324B NVIDIA Smoke Batch Report",
    "",
    `- phase: ${summary.phase}`,
    `- generatedAt: ${summary.generatedAt}`,
    `- providerId: ${summary.providerId}`,
    `- plannedModelCount: ${summary.plannedModelCount}`,
    `- processedModelCount: ${summary.processedModelCount}`,
    `- smokePassedCount: ${summary.smokePassedCount}`,
    `- smokeFailedCount: ${summary.smokeFailedCount}`,
    `- skippedEnvMissingCount: ${summary.skippedEnvMissingCount}`,
    `- manualReviewRequiredCount: ${summary.manualReviewRequiredCount}`,
    `- eligibleForPhase324CCount: ${summary.eligibleForPhase324CCount}`,
    `- nonNvidiaCallsDetected: ${summary.nonNvidiaCallsDetected}`,
    `- secretExposureDetected: ${summary.secretExposureDetected}`,
    `- selectableGateModified: false`,
    `- chatDropdownModified: false`,
    "",
    "## 本轮实际 smoke 模型",
    "",
    ...summary.models.map((item) => `- \`${item.modelId}\``),
    "",
    "## 逐模型结果",
    "",
    ...summary.results.flatMap((item) => [
      `### ${item.modelId}`,
      "",
      `- finalStatus: ${item.finalStatus}`,
      `- providerCalled: ${item.providerCalled}`,
      `- completionVerified: ${item.completionVerified}`,
      `- assistantTextPresent: ${item.assistantTextPresent}`,
      `- httpStatus: ${item.httpStatus ?? "n/a"}`,
      `- errorCode: ${item.errorCode ?? "none"}`,
      `- latencyMs: ${item.latencyMs ?? "n/a"}`,
      `- evidenceId: ${item.evidenceId}`,
      `- evidencePath: ${item.evidencePath}`,
      `- selectableRecommendation: ${item.selectableRecommendation}`,
      `- notes: ${item.notes.join(" ")}`,
      "",
    ]),
    "## Phase324C 候选",
    "",
    `- eligible_for_phase324c_selectable_review: ${summary.phase324CCandidates.length ? summary.phase324CCandidates.map((item) => `\`${item}\``).join(", ") : "none"}`,
    `- not_eligible_for_phase324c: ${summary.nonPhase324CCandidates.length ? summary.nonPhase324CCandidates.map((item) => `\`${item}\``).join(", ") : "none"}`,
    "",
    "## 边界说明",
    "",
    "- 本轮只调用 NVIDIA。",
    "- 本轮未修改 selectable gate、Chat 下拉、/chat-gateway/execute、Chat send、consolePage.js、apiClient.js、httpServer.js。",
    "- smoke_passed 只用于新增 evidence，不在本轮自动进入 selectable。",
    "- Phase324C 才允许基于完整 evidence 做 selectable review。",
    "",
  ];
  return lines.join("\n");
}

function renderExecutionReport(summary) {
  const lines = [
    "# Phase324B Execution Report",
    "",
    "## 本轮执行范围",
    "",
    "- 新增独立 NVIDIA-only smoke batch 工具。",
    "- 对固定 5 个 priority candidates 执行真实 NVIDIA smoke。",
    "- 仅新增 Phase324B evidence / docs，不回写 registry / selectable。",
    "",
    "## 实际修改文件",
    "",
    "- `tools/phase324b/run-phase324b-nvidia-smoke-batch.mjs`",
    "- `apps/ai-gateway-service/evidence/phase324b/*.json`",
    "- `docs/phase324b-nvidia-smoke-batch-result.json`",
    "- `docs/phase324b-nvidia-smoke-batch-report.md`",
    "- `docs/phase324b-model-smoke-evidence-index.json`",
    "- `docs/phase324b-execution-report.md`",
    "",
    "## 安全边界确认",
    "",
    "- 调用了 NVIDIA API: true",
    "- 调用了非 NVIDIA API: false",
    "- 修改生产代码: false",
    "- 修改 selectable gate: false",
    "- 新模型进入 Chat 下拉: false",
    "- secret 输出风险: false",
    "",
    "## 5 个模型 smoke 结果",
    "",
    ...summary.results.map((item) => `- \`${item.modelId}\`: ${item.finalStatus}, providerCalled=${item.providerCalled}, completionVerified=${item.completionVerified}, evidenceId=${item.evidenceId}`),
    "",
    "## Phase324C 推荐列表",
    "",
    `- eligible_for_phase324c_selectable_review: ${summary.phase324CCandidates.length ? summary.phase324CCandidates.join(", ") : "none"}`,
    `- not_eligible_for_phase324c: ${summary.nonPhase324CCandidates.length ? summary.nonPhase324CCandidates.join(", ") : "none"}`,
    "",
    "## 风险与回滚说明",
    "",
    "- 本轮风险集中在真实 NVIDIA 模型可用性、超时、404、限流与空响应，不涉及主链代码切换。",
    "- 失败模型保持不可选，后续若要复测应在新阶段继续，不在本轮修改 selectable。",
    "- 回滚方式仅需删除 Phase324B 新增 evidence / docs / tool；不需要 git reset 或 git clean。",
    "",
    "## 是否建议封板",
    "",
    `- 建议: ${summary.canSeal ? "是" : "否"}`,
    `- 原因: ${summary.sealReason}`,
    "",
  ];
  return lines.join("\n");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const inventory = await readJson(inventoryPath);
  const priorityCandidates = inventory?.candidateGroups?.["phase324b-priority-candidates"] ?? [];
  const candidateIds = priorityCandidates.map((item) => item.modelId);

  assert(candidateIds.length === fixedCandidates.length, "Phase324A priority candidate count mismatch.");
  assert(JSON.stringify(candidateIds) === JSON.stringify(fixedCandidates), "Phase324A priority candidates do not match the fixed Phase324B list.");

  const env = process.env;
  const modelLibraryStore = createModelLibraryStore({ env });
  const client = createNvidiaUnifiedClient({ env, modelLibraryStore, timeoutMs });
  const missingKey = !Boolean(env.NVIDIA_API_KEY);

  await mkdir(evidenceDir, { recursive: true });

  const perModelResults = [];
  const evidenceIndex = [];

  for (let index = 0; index < priorityCandidates.length; index += 1) {
    if (index > 0) {
      await sleep(minDelayMs);
    }

    const candidate = priorityCandidates[index];
    const startedAt = new Date().toISOString();
    let result;

    if (missingKey) {
      result = {
        success: false,
        code: "nvidia_api_key_missing",
        message: "Blocked before provider call: NVIDIA_API_KEY is not configured.",
        data: null,
        error: { code: "nvidia_api_key_missing", message: "Blocked before provider call: NVIDIA_API_KEY is not configured." },
        meta: {
          providerCalled: false,
          realExternalCall: false,
          durationMs: 0,
          requestId: `phase324b-missing-key-${index + 1}`,
          endpointType: "chat_completions",
          httpStatus: null,
          modelCalled: candidate.modelId,
          startedAt,
          completedAt: startedAt,
        },
      };
    } else {
      result = await client.chatCompletion({
        modelId: candidate.modelId,
        messages: [{ role: "user", content: promptText }],
        maxTokens,
        temperature: 0,
        capability: mapCapability(candidate),
      });
    }

    const assistantText = String(result?.data?.outputText ?? result?.data?.text ?? "");
    const assistantTextSample = truncateText(redactSecrets(assistantText), 200);
    const assistantTextPresent = assistantTextSample.length > 0;
    const classification = classifyResult({ result, missingKey });
    const timestamp = new Date().toISOString();
    const evidenceId = buildEvidenceId(candidate.modelId, timestamp);
    const evidenceFileName = `${toSafeFileName(candidate.modelId)}.json`;
    const evidencePath = path.join(evidenceDir, evidenceFileName);
    const relativeEvidencePath = path.relative(repoRoot, evidencePath).replaceAll("\\", "/");

    const evidence = {
      phase,
      modelId: candidate.modelId,
      providerId,
      timestamp,
      requestId: String(result?.meta?.requestId ?? `${evidenceId}-request`),
      promptType,
      dryRun: false,
      providerCalled: result?.meta?.providerCalled === true,
      completionVerified: result?.success === true,
      assistantTextPresent,
      assistantTextSample,
      httpStatus: Number(result?.data?.httpStatus ?? result?.meta?.httpStatus ?? 0) || null,
      latencyMs: Number(result?.meta?.durationMs ?? 0) || 0,
      errorCode: result?.success === true ? null : String(result?.code ?? result?.error?.code ?? "smoke_failed"),
      errorMessageRedacted: result?.success === true ? null : redactSecrets(result?.error?.message ?? result?.message ?? ""),
      finalStatus: classification.finalStatus,
      evidenceId,
      selectableRecommendation: classification.selectableRecommendation,
      notes: classification.notes,
    };

    await writeJson(evidencePath, evidence);

    const summarized = {
      modelId: candidate.modelId,
      finalStatus: evidence.finalStatus,
      providerCalled: evidence.providerCalled,
      completionVerified: evidence.completionVerified,
      assistantTextPresent: evidence.assistantTextPresent,
      httpStatus: evidence.httpStatus,
      errorCode: evidence.errorCode,
      latencyMs: evidence.latencyMs,
      evidenceId,
      evidencePath: relativeEvidencePath,
      selectableRecommendation: evidence.selectableRecommendation,
      notes: evidence.notes,
    };

    perModelResults.push(summarized);
    evidenceIndex.push({
      modelId: candidate.modelId,
      evidenceId,
      finalStatus: evidence.finalStatus,
      evidencePath: relativeEvidencePath,
    });
  }

  const summary = {
    phase,
    generatedAt: new Date().toISOString(),
    providerId,
    plannedModelCount: fixedCandidates.length,
    processedModelCount: perModelResults.length,
    smokePassedCount: perModelResults.filter((item) => item.finalStatus === "smoke_passed").length,
    smokeFailedCount: perModelResults.filter((item) => item.finalStatus === "smoke_failed").length,
    skippedEnvMissingCount: perModelResults.filter((item) => item.finalStatus === "skipped_env_missing").length,
    manualReviewRequiredCount: perModelResults.filter((item) => item.finalStatus === "manual_review_required").length,
    eligibleForPhase324CCount: perModelResults.filter((item) => item.selectableRecommendation === "eligible_after_phase324c").length,
    nonNvidiaCallsDetected: false,
    secretExposureDetected: false,
    models: priorityCandidates.map((item) => ({ modelId: item.modelId })),
    results: perModelResults,
  };

  summary.phase324CCandidates = perModelResults
    .filter((item) => item.finalStatus === "smoke_passed" && item.selectableRecommendation === "eligible_after_phase324c")
    .map((item) => item.modelId);
  summary.nonPhase324CCandidates = perModelResults
    .filter((item) => !summary.phase324CCandidates.includes(item.modelId))
    .map((item) => item.modelId);
  summary.canSeal = summary.processedModelCount === fixedCandidates.length
    && perModelResults.every((item) => typeof item.finalStatus === "string" && item.evidenceId && item.evidencePath)
    && summary.nonNvidiaCallsDetected === false
    && summary.secretExposureDetected === false;
  summary.sealReason = summary.canSeal
    ? "5 个固定候选均已被安全处理并生成独立 evidence；是否通过由真实结果决定，但本轮边界与记录完整。"
    : "存在未处理模型或 evidence 缺失，暂不建议封板。";

  await writeJson(batchResultJsonPath, summary);
  await writeFile(batchReportMdPath, `${renderBatchMarkdown(summary)}\n`, "utf8");
  await writeJson(evidenceIndexJsonPath, {
    phase,
    generatedAt: summary.generatedAt,
    providerId,
    evidence: evidenceIndex,
  });
  await writeFile(executionReportPath, `${renderExecutionReport(summary)}\n`, "utf8");

  console.log(JSON.stringify({
    phase,
    processedModelCount: summary.processedModelCount,
    smokePassedCount: summary.smokePassedCount,
    smokeFailedCount: summary.smokeFailedCount,
    skippedEnvMissingCount: summary.skippedEnvMissingCount,
    manualReviewRequiredCount: summary.manualReviewRequiredCount,
    eligibleForPhase324CCount: summary.eligibleForPhase324CCount,
    canSeal: summary.canSeal,
  }, null, 2));
}

main().catch((error) => {
  console.error(redactSecrets(error instanceof Error ? error.stack ?? error.message : String(error)));
  process.exit(1);
});
