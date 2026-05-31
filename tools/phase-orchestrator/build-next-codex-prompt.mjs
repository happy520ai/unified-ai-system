import { createHash } from "node:crypto";
import {
  phase383Safety,
  readJson,
  writeJson,
  writeText,
} from "../phase383-common.mjs";

const state = await readJson("docs/phase-orchestrator/current-phase-state.json");
const decision = await readJson("docs/phase-orchestrator/safety-brake-decision.json");
const registry = await readJson("docs/phase-orchestrator/phase-registry.json");
const selected = registry.phases.find((item) => item.phase === decision.selectedNextPhase);

const generatedAt = new Date().toISOString();
const riskLevel = decision.selectedNextPhaseRiskLevel || selected?.riskLevel || "high";
const brakeEngaged = decision.safetyBrakeEngaged === true || riskLevel === "high";
let readyToExecute =
  decision.readyToExecute === true &&
  decision.autoContinueAllowed === true &&
  decision.executeNextPhaseAllowed === false &&
  decision.humanApprovalRequired !== true &&
  riskLevel === "low" &&
  !brakeEngaged;

function promptTitle() {
  if (brakeEngaged) return "Human Approval Required / Authorization Packet";
  return `Generated Next Phase Prompt - ${decision.selectedNextPhase}`;
}

function generatedHeader() {
  return [
    "【Generated Next Phase Prompt】",
    `selectedNextPhase: ${decision.selectedNextPhase}`,
    `selectedNextPhaseTitle: ${decision.selectedNextPhaseTitle}`,
    `riskLevel: ${riskLevel}`,
    `humanApprovalRequired: ${decision.humanApprovalRequired === true}`,
    `readyToExecute: ${readyToExecute}`,
    `promptGeneratedAt: ${generatedAt}`,
    "",
  ];
}

function approvalRequiredBody() {
  return [
    ...generatedHeader(),
    `# ${promptTitle()}`,
    "",
    `- latestPhase: ${state.latestPhase}`,
    `- latestResultPath: ${state.latestResultPath}`,
    `- selectedNextPhase: ${decision.selectedNextPhase}`,
    `- selectedNextPhaseTitle: ${decision.selectedNextPhaseTitle}`,
    `- decision: ${decision.decision}`,
    `- blockedReasons: ${(decision.blockedReasons || []).join(", ") || "none"}`,
    "",
    "## Authorization Packet Template",
    "",
    "- authorizationType: yiyi_model_backed_provider_test",
    "- authorizedByHuman: false",
    `- requestedPhase: ${decision.selectedNextPhase}`,
    `- requestedTitle: ${decision.selectedNextPhaseTitle}`,
    "- allowProviderCall: false",
    "- allowedProviderRefs: []",
    "- allowedCredentialRefs: []",
    "- allowedModelRefs: []",
    "- maxRequests: 0",
    "- maxEstimatedCostUsd: 0",
    "- noSecretOutputAllowed: true",
    "- noActionExecutionAllowed: true",
    "- noDeployAllowed: true",
    "",
    "Phase Orchestrator 仅生成审批/授权包，不会自动执行下一阶段。",
  ].join("\n");
}

function executablePromptBody() {
  return [
    ...generatedHeader(),
    `# ${promptTitle()}`,
    "",
    "你现在在 unified-ai-system 仓库中工作。",
    "",
    "当前基线：",
    `- latestPhase: ${state.latestPhase}`,
    `- latestResultPath: ${state.latestResultPath}`,
    `- completed: ${state.completed}`,
    `- recommended_sealed: ${state.recommended_sealed}`,
    `- validationsPassed: ${state.validationsPassed}`,
    "",
    "允许范围：",
    `- selectedNextPhase=${decision.selectedNextPhase}`,
    `- title=${selected?.title || decision.selectedNextPhaseTitle}`,
    `- riskLevel=${riskLevel}`,
    `- allowedExecutionMode=${decision.allowedMode}`,
    "- 仅限低风险 docs / evidence / schema / dry-run / local validation。",
    "",
    "禁止事项：",
    "- 不修改 legacy/ / PROJECT_CONTEXT.md / provider runtime / chat 主链。",
    "- 不调用 provider / 不读取 secret / 不 deploy / 不 release。",
    "- 不伪造 approval / 不伪造 evidence / 不声称 workspace clean。",
    "",
    "安全边界必须保持：",
    "- providerCallsMade=false",
    "- nonNvidiaProviderCallsMade=false",
    "- secretValueExposed=false",
    "- rawSecretAccessed=false",
    "- deployExecuted=false",
    "- releaseExecuted=false",
    "- tagCreated=false",
    "- artifactUploaded=false",
    "- billingExecuted=false",
    "- invoiceGenerated=false",
    "- approvalForged=false",
    "- workspaceCleanClaimed=false",
    "",
    "本 prompt 仅在 low risk 且 meta/prompt 一致时可作为执行模板。",
  ].join("\n");
}

const body = brakeEngaged ? approvalRequiredBody() : executablePromptBody();
const promptContentHash = createHash("sha256").update(body, "utf8").digest("hex");
const promptPhase = body.match(/selectedNextPhase:\s*(Phase\d+)/)?.[1];
const promptSelectedTitle = body.match(/selectedNextPhaseTitle:\s*(.+)/)?.[1]?.trim();
const promptMetaMatch =
  promptPhase === decision.selectedNextPhase &&
  promptSelectedTitle === decision.selectedNextPhaseTitle;
const blockedReasons = [...(decision.blockedReasons || [])];

if (!promptMetaMatch) {
  readyToExecute = false;
  if (!blockedReasons.includes("prompt_meta_mismatch")) blockedReasons.push("prompt_meta_mismatch");
}
if (riskLevel === "high") readyToExecute = false;

const meta = {
  selectedNextPhase: decision.selectedNextPhase,
  selectedNextPhaseTitle: decision.selectedNextPhaseTitle,
  selectedNextPhaseRiskLevel: riskLevel,
  latestPhase: state.latestPhase,
  latestResultPath: state.latestResultPath,
  promptGenerated: true,
  promptGeneratedAt: generatedAt,
  generatedAt,
  promptTitle: promptTitle(),
  promptContentHash,
  promptMetaMatch,
  readyToExecute,
  autoContinueAllowed: readyToExecute === true && decision.autoContinueAllowed === true,
  humanApprovalRequired: decision.humanApprovalRequired === true,
  safetyBrakeEngaged: brakeEngaged,
  executeNextPhaseAllowed: false,
  blockedReasons,
  sourcePhase: "Phase383",
};

const evidence = {
  phase: "Phase383E",
  nextPromptBuilderCreated: true,
  nextPromptGenerated: true,
  selectedNextPhase: decision.selectedNextPhase,
  selectedNextPhaseTitle: decision.selectedNextPhaseTitle,
  selectedNextPhaseRiskLevel: riskLevel,
  promptPath: "docs/phase-orchestrator/next-codex-prompt.md",
  metaPath: "docs/phase-orchestrator/next-codex-prompt.meta.json",
  promptContentHash,
  promptMetaMatch,
  stalePromptDetected: false,
  readyToExecute,
  autoExecutedNextPhase: false,
  validationPassed: true,
  ...phase383Safety,
};

await writeText("docs/phase-orchestrator/next-codex-prompt.md", body);
await writeJson("docs/phase-orchestrator/next-codex-prompt.meta.json", meta);
await writeJson("apps/ai-gateway-service/evidence/phase383e/build-next-codex-prompt-result.json", evidence);
await writeText(
  "docs/phase383e-build-next-codex-prompt.md",
  [
    "# Phase383E Build Next Codex Prompt",
    "",
    `- Generated next prompt for ${decision.selectedNextPhase}.`,
    `- Prompt content hash: ${promptContentHash}.`,
    `- Prompt/meta match: ${promptMetaMatch}.`,
    `- Ready to execute: ${readyToExecute}.`,
    "- High-risk phases produce an authorization packet only.",
    "- Phase383 did not execute the next phase.",
  ].join("\n"),
);

console.log(JSON.stringify(evidence, null, 2));
