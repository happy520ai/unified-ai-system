import { spawnSync } from "node:child_process";
import {
  phase383Safety,
  readJson,
  writeJson,
  writeText,
} from "../phase383-common.mjs";

const startedAt = new Date().toISOString();
const requestedMaxAutoPhases = Number(process.env.PHASE_AUTO_NEXT_MAX || 10);
const maxAutoPhases = requestedMaxAutoPhases > 10 ? 10 : requestedMaxAutoPhases;
const maxAutoPhaseWarning = requestedMaxAutoPhases > 10 ? "max_auto_phases_capped_at_10" : null;
const steps = [
  "tools/phase383a/validate-phase-result-schema.mjs",
  "tools/phase383b/validate-phase-registry-risk-policy.mjs",
  "tools/phase-orchestrator/read-latest-phase-state.mjs",
  "tools/phase-orchestrator/evaluate-safety-brake.mjs",
  "tools/phase-orchestrator/build-next-codex-prompt.mjs",
];

const stepResults = [];
for (const script of steps) {
  const child = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  stepResults.push({
    script,
    exitCode: child.status,
    stdoutTail: child.stdout.trim().slice(-1200),
    stderrTail: child.stderr.trim().slice(-1200),
  });
  if (child.status !== 0) {
    throw new Error(`Auto-next dry-run step failed: ${script}\n${child.stderr}`);
  }
}

const state = await readJson("docs/phase-orchestrator/current-phase-state.json");
const decision = await readJson("docs/phase-orchestrator/safety-brake-decision.json");
const promptMeta = await readJson("docs/phase-orchestrator/next-codex-prompt.meta.json");
const blockedReasons = [...(decision.blockedReasons || []), ...(promptMeta.blockedReasons || [])];
const selectedNextPhaseRiskLevel = decision.selectedNextPhaseRiskLevel || promptMeta.selectedNextPhaseRiskLevel || "high";
const phase384Selected = decision.selectedNextPhase === "Phase384";
const humanApprovalRequired = phase384Selected ? true : decision.humanApprovalRequired === true;
const safetyBrakeEngaged =
  phase384Selected ||
  decision.safetyBrakeEngaged === true ||
  promptMeta.safetyBrakeEngaged === true ||
  promptMeta.readyToExecute !== true ||
  promptMeta.promptMetaMatch !== true ||
  promptMeta.stalePromptDetected === true ||
  blockedReasons.length > 0;
const autoContinueAllowed =
  phase384Selected
    ? false
    : decision.autoContinueAllowed === true &&
      promptMeta.autoContinueAllowed === true &&
      promptMeta.readyToExecute === true &&
      promptMeta.promptMetaMatch === true &&
      promptMeta.stalePromptDetected !== true &&
      humanApprovalRequired === false &&
      safetyBrakeEngaged === false &&
      selectedNextPhaseRiskLevel === "low";
const stoppedReason =
  phase384Selected
    ? "phase384_requires_explicit_human_authorization"
    : humanApprovalRequired === true || selectedNextPhaseRiskLevel === "high"
      ? "human_approval_required_or_high_risk_phase"
      : promptMeta.stalePromptDetected === true
        ? "stale_prompt_detected"
        : promptMeta.promptMetaMatch !== true || blockedReasons.includes("next_prompt_mismatch")
          ? "next_prompt_mismatch"
          : promptMeta.readyToExecute === false
            ? "ready_to_execute_false"
            : decision.safetyBrakeEngaged === true
              ? "safety_brake_engaged"
              : maxAutoPhases === 0
                ? "auto_run_limit_reached"
                : null;
const executedPhases = [];
const skippedHighRiskPhases = selectedNextPhaseRiskLevel === "high" ? [decision.selectedNextPhase] : [];
const humanApprovalRequiredPhases = humanApprovalRequired ? [decision.selectedNextPhase] : [];

const result = {
  phase: "Phase383",
  completed: true,
  recommended_sealed: true,
  maxAutoPhases,
  requestedMaxAutoPhases,
  maxAutoPhaseWarning,
  actuallyExecutedPhases: 0,
  stoppedReason,
  executedPhases,
  skippedHighRiskPhases,
  humanApprovalRequiredPhases,
  autoNextDryRunCompleted: true,
  latestPhaseRead: true,
  latestPhaseBeforeRun: state.latestPhase,
  latestPhaseAfterRun: state.latestPhase,
  latestPhase: state.latestPhase,
  latestResultPath: state.latestResultPath,
  safetyBrakeEvaluated: true,
  nextPromptGenerated: promptMeta.promptGenerated === true,
  promptContentHash: promptMeta.promptContentHash,
  promptMetaMatch: promptMeta.promptMetaMatch,
  promptReadyToExecute: promptMeta.readyToExecute,
  selectedNextPhase: decision.selectedNextPhase,
  selectedNextPhaseTitle: decision.selectedNextPhaseTitle,
  selectedNextPhaseRiskLevel,
  autoExecutedNextPhase: false,
  executeNextPhaseAllowed: false,
  autoContinueAllowed,
  humanApprovalRequired,
  safetyBrakeEngaged,
  safetyBrakeTriggered: safetyBrakeEngaged,
  highRiskPhaseStillBlocked: selectedNextPhaseRiskLevel === "high" ? safetyBrakeEngaged === true : true,
  phase384StillRequiresHumanApproval: phase384Selected ? humanApprovalRequired === true : true,
  promptMetaMatchRequired: promptMeta.promptMetaMatch === true,
  stalePromptBlocked: promptMeta.stalePromptDetected === true ? safetyBrakeEngaged === true : true,
  providerCallsMade: false,
  nonNvidiaProviderCallsMade: false,
  secretValueExposed: false,
  rawSecretAccessed: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  evidenceModified: false,
  approvalForged: false,
  billingExecuted: false,
  invoiceGenerated: false,
  productionGaClaimed: false,
  dangerousActionButtonDetected: false,
  workspaceCleanClaimed: false,
  highRiskPhaseRequiresHumanApproval: true,
  providerCallRequiresHumanApproval: true,
  deployRequiresHumanApproval: true,
  secretAccessRequiresHumanApproval: true,
  billingRequiresHumanApproval: true,
  approvalModificationRequiresHumanApproval: true,
  safetyGateRelaxationBlocked: true,
  nextPhaseAutoExecutionBlocked: true,
  validationsPassed: true,
  validationsRun: steps.map((script) => `node ${script}`),
  blocker: null,
  remainingRisks: [
    "prompt_generation_only_no_next_phase_execution",
    "human_approval_workflow_not_integrated",
    "phase_registry_needs_future_expansion",
    "dashboard_not_integrated",
    "safety_policy_self_modification_guard_should_be_deepened_later"
  ],
  nextRecommendedPhases: state.nextRecommendedPhases || [],
  rollbackPlan: [
    "Remove docs/phase-orchestrator Phase383 generated files.",
    "Remove tools/phase-orchestrator scripts and Phase383 validators.",
    "Remove Phase383 package scripts if needed."
  ],
  startedAt,
  completedAt: new Date().toISOString(),
  stepResults,
};

await writeJson("apps/ai-gateway-service/evidence/phase383f/auto-next-dry-run-result.json", result);
await writeJson("apps/ai-gateway-service/evidence/phase383/phase-orchestrator-safety-brake-closure-result.json", result);
await writeText(
  "docs/phase-orchestrator/auto-next-report.md",
  [
    "# Phase383 Auto-next Dry-run Report",
    "",
    `- Latest phase read: ${state.latestPhase}.`,
    `- Selected next phase: ${decision.selectedNextPhase}.`,
    `- Decision: ${decision.decision}.`,
    "- Next phase execution allowed: false.",
    "- Auto-executed next phase: false.",
    "- Provider calls made: false.",
    "- Secret values exposed: false.",
    "- Deploy/release/tag/artifact actions executed: false.",
    `- Max auto phases: ${maxAutoPhases}.`,
    `- Stopped reason: ${stoppedReason || "none"}.`,
  ].join("\n"),
);
await writeText(
  "docs/phase-orchestrator/auto-run-final-report.md",
  [
    "# Phase383 Auto-run Final Report",
    "",
    `- maxAutoPhases=${maxAutoPhases}`,
    `- actuallyExecutedPhases=${result.actuallyExecutedPhases}`,
    `- stoppedReason=${stoppedReason || "none"}`,
    `- executedPhases=${executedPhases.join(", ") || "[]"}`,
    `- skippedHighRiskPhases=${skippedHighRiskPhases.join(", ") || "[]"}`,
    `- humanApprovalRequiredPhases=${humanApprovalRequiredPhases.join(", ") || "[]"}`,
    `- latestPhaseBeforeRun=${result.latestPhaseBeforeRun}`,
    `- latestPhaseAfterRun=${result.latestPhaseAfterRun}`,
    `- safetyBrakeTriggered=${result.safetyBrakeTriggered}`,
    "- providerCallsMade=false",
    "- secretValueExposed=false",
    "- deployExecuted=false",
    "- workspaceCleanClaimed=false",
  ].join("\n"),
);
await writeText(
  "docs/phase383-phase-orchestrator-safety-brake-closure.md",
  [
    "# Phase383 Phase Orchestrator + Safety Brake Closure",
    "",
    "Phase383 adds a governance-only phase orchestrator.",
    "",
    "Completed:",
    "- Phase Result Standard Contract.",
    "- Phase Registry / Risk Policy.",
    "- Latest Phase State Reader.",
    "- Safety Brake Evaluator.",
    "- Next Codex Prompt Builder.",
    "- Auto-next Dry-run.",
    "",
    "Boundary:",
    "- Does not execute the next phase.",
    "- Does not call providers.",
    "- Does not read secrets.",
    "- Does not deploy, release, create tags, upload artifacts, bill, invoice, or forge approvals.",
    "- Does not claim workspace clean.",
    "",
    `Recommended next phase: ${decision.selectedNextPhase} (${decision.selectedNextPhaseTitle}).`,
  ].join("\n"),
);

console.log(JSON.stringify(result, null, 2));
