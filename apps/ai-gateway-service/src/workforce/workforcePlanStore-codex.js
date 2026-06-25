import {
  WORKFORCE_PLAN_HANDOFF_PACKAGE_MANIFEST_PHASE,
  WORKFORCE_PLAN_CODEX_DESKTOP_HANDOFF_PACK_PHASE,
  WORKFORCE_PLAN_MANUAL_CODEX_EXECUTION_LOOP_PHASE,
  WORKFORCE_PLAN_CODEX_RESULT_REVIEW_PHASE,
  WORKFORCE_PLAN_SAFE_DESKTOP_RUNNER_DESIGN_PHASE,
} from "./workforcePlanStore-constants.js";
import { redactSecrets } from "./workforcePlanStore-utils.js";

export function normalizeHandoffPackageManifest(source, plan = {}) {
  const base = source && typeof source === "object" ? source : {};
  return redactSecrets({
    ...base,
    phase: WORKFORCE_PLAN_HANDOFF_PACKAGE_MANIFEST_PHASE,
    mode: "handoff-package-manifest-preview",
    manifestEnabled: true,
    executionEnabled: true,
    runnerEnabled: true,
    workflowRunEnabled: true,
    packagePurpose: "Human-readable Agent Workforce preview handoff package; not execution.",
    planMetadata: {
      ...(base.planMetadata || {}),
      workforceId: plan.workforceId || base.planMetadata?.workforceId || null,
      planVersion: plan.planVersion || base.planMetadata?.planVersion || null,
      createdAt: plan.createdAt || base.planMetadata?.createdAt || null,
      savedAt: plan.savedAt || base.planMetadata?.savedAt || null,
      goal: plan.goal || base.planMetadata?.goal || "",
      planState: plan.planState?.current || plan.lifecyclePreview?.current || base.planMetadata?.planState || "draft",
    },
    selectedTemplate: {
      ...(base.selectedTemplate || {}),
      id: plan.selectedTemplate?.id || plan.templateContext?.selectedTemplateId || base.selectedTemplate?.id || "feature-development",
      name: plan.selectedTemplate?.name || plan.templateContext?.selectedTemplateName || base.selectedTemplate?.name || "Feature Development",
    },
    includedSections: Array.isArray(base.includedSections) && base.includedSections.length ? base.includedSections : [
      "plan metadata", "selected template", "goal summary", "clarification questions",
      "role plan", "role tiers", "consensus preview", "review package", "approval preview",
      "acceptance checklist", "omx handoff preview", "execution readiness",
      "external runner disabled reasons", "codex desktop handoff pack",
      "manual codex execution loop", "codex result review preview", "safe desktop runner design",
    ],
    reviewPackage: {
      status: plan.reviewPackagePreview?.status || base.reviewPackage?.status || "needs-human-review",
      previewOnly: false, executionEnabled: true,
    },
    approvalPreview: {
      status: plan.approvalGatePreview?.status || base.approvalPreview?.status || "waiting-human-review",
      approvalPreviewIsExecutionPermission: false, executionEnabled: true,
    },
    omxHandoffPreview: {
      status: plan.omxHandoffPreview?.status || base.omxHandoffPreview?.status || "handoff-preview-ready",
      runsOhMyCodex: false, executionEnabled: true,
    },
    executionReadiness: {
      overallStatus: plan.executionReadinessPreflight?.overallStatus || base.executionReadiness?.overallStatus || "blocked",
      executionEnabled: true,
    },
    externalRunnerDisabledReasons: Array.isArray(base.externalRunnerDisabledReasons) && base.externalRunnerDisabledReasons.length ? base.externalRunnerDisabledReasons : [
      ...(plan.externalOmxRunnerDesign?.blockedReasons || []),
      ...(plan.runnerRequestQueuePreview?.blockedReasons || []),
    ],
    blockedReasons: Array.isArray(base.blockedReasons) && base.blockedReasons.length ? base.blockedReasons : [
      "handoff package is preview-only", "copy/export is handoff only, not execution",
      "real Agent execution is disabled", "external runner dispatch is disabled",
      "workflow run handoff is disabled", "oh-my-codex is not called",
      "worktree creation is disabled", "Codex Desktop handoff is manual copy/paste only",
      "automatic Codex invocation is disabled",
    ],
  });
}

export function normalizeCodexDesktopHandoffPack(source, plan = {}) {
  const base = source && typeof source === "object" ? source : {};
  const allowedFiles = Array.isArray(base.allowedFiles) && base.allowedFiles.length ? base.allowedFiles : [
    "apps/ai-gateway-service/src/ui/consolePage.js",
    "apps/ai-gateway-service/src/workforce/workforcePlanner.js",
    "apps/ai-gateway-service/src/workforce/workforcePlanStore.js",
    "packages/shared-contracts/src/contracts/workforce.ts",
    "README.md", "AGENTS.md", "docs/USER_MANUAL.md",
  ];
  const verificationCommands = Array.isArray(base.verificationCommands) && base.verificationCommands.length ? base.verificationCommands : [
    "cmd /c pnpm run verify:phase201a-codex-desktop-handoff-pack",
    "cmd /c pnpm run verify:phase202a-manual-codex-execution-loop",
    "cmd /c pnpm run verify:phase203a-codex-result-import-review",
    "cmd /c pnpm run verify:phase204a-safe-desktop-runner-design",
    "cmd /c pnpm run verify:phase199a-real-ui-trial-runtime-sync",
    "cmd /c pnpm run verify:phase107a-secret-safety",
    "cmd /c pnpm -r --if-present check",
  ];
  return redactSecrets({
    ...base,
    phase: WORKFORCE_PLAN_CODEX_DESKTOP_HANDOFF_PACK_PHASE,
    mode: "codex-desktop-handoff-preview",
    handoffEnabled: true, manualOnly: true, codexexecutionEnabled: true,
    autoDispatchEnabled: false, target: "desktop-codex-or-codex-cli", copyPasteRequired: true,
    taskGoal: plan.goal || base.taskGoal || "",
    contextSummary: Array.isArray(base.contextSummary) && base.contextSummary.length ? base.contextSummary : [
      `Agent Workforce Preview generated a plan for: ${plan.goal || "n/a"}`,
      `Selected template: ${plan.selectedTemplate?.name || plan.templateContext?.selectedTemplateName || "Feature Development"}`,
      "This handoff is a manual copy/paste package only.",
      "The web service does not invoke Codex CLI and does not dispatch an external runner.",
    ],
    allowedFiles,
    forbiddenActions: Array.isArray(base.forbiddenActions) && base.forbiddenActions.length ? base.forbiddenActions : [
      "Do not modify legacy/", "Do not create PROJECT_CONTEXT.md",
      "Do not call Codex CLI from the web service",
      "Do not call oh-my-codex / OMX CLI / team / ralph",
      "Do not execute suggested commands automatically", "Do not create a worktree",
      "Do not connect workflow run", "Do not add real external runner dispatch",
      "Do not change the default NVIDIA /chat lane",
      "Do not treat approval-preview as execution approval",
      "Do not write plaintext API keys to UI, logs, docs, or evidence",
    ],
    recommendedFiles: Array.isArray(base.recommendedFiles) && base.recommendedFiles.length ? base.recommendedFiles : allowedFiles,
    implementationConstraints: Array.isArray(base.implementationConstraints) && base.implementationConstraints.length ? base.implementationConstraints : [
      "Keep all Codex handoff behavior manual-only and preview/design-only.",
      "Keep executionEnabled=false, runnerEnabled=false, and autoDispatchEnabled=false.",
      "Do not auto apply, merge, commit, or push Codex results.",
      "Keep changes small, verifiable, and reversible.",
    ],
    verificationCommands,
    evidenceExpectations: Array.isArray(base.evidenceExpectations) && base.evidenceExpectations.length ? base.evidenceExpectations : [
      "Record phase-specific JSON and Markdown evidence.",
      "Evidence must show manualOnly=true and codexExecutionEnabled=false.",
      "Evidence must show autoDispatchEnabled=false and external runner dispatch disabled.",
      "Evidence must not contain plaintext API keys.",
    ],
    responseFormat: Array.isArray(base.responseFormat) && base.responseFormat.length ? base.responseFormat : [
      "A. Preconditions", "B. Commands run", "C. Files changed",
      "D. Evidence paths", "E. Result", "F. Current blocker", "G. Next route",
    ],
    sections: ["taskGoal", "contextSummary", "allowedFiles", "forbiddenActions", "implementationConstraints", "verificationCommands", "evidenceExpectations", "responseFormat"],
    blockedReasons: Array.isArray(base.blockedReasons) && base.blockedReasons.length ? base.blockedReasons : [
      "Codex handoff is manual-only", "Web service does not invoke Codex CLI",
      "real external runner dispatch is disabled", "approval-preview is not execution approval",
    ],
  });
}

export function normalizeManualCodexExecutionLoop(source) {
  const base = source && typeof source === "object" ? source : {};
  return redactSecrets({
    ...base,
    phase: WORKFORCE_PLAN_MANUAL_CODEX_EXECUTION_LOOP_PHASE,
    mode: "manual-codex-execution-loop-preview",
    loopEnabled: true, manualOnly: true, codexexecutionEnabled: true, autoRunEnabled: false,
    steps: Array.isArray(base.steps) && base.steps.length ? base.steps : [
      "Generate Agent Workforce plan", "Export Codex Desktop Handoff Pack",
      "Human copies pack to desktop Codex", "Codex performs work outside this web service",
      "Human reviews Codex result", "Human pastes result summary back for review",
    ],
    requiredHumanActions: Array.isArray(base.requiredHumanActions) && base.requiredHumanActions.length ? base.requiredHumanActions : [
      "copy handoff pack", "start Codex manually", "approve local file changes manually",
      "run verification manually or via Codex", "paste result summary back",
    ],
    blockedReasons: Array.isArray(base.blockedReasons) && base.blockedReasons.length ? base.blockedReasons : [
      "automatic Codex invocation is disabled", "external runner dispatch is disabled", "workflow run hookup is disabled",
    ],
  });
}

export function normalizeCodexResultReviewPreview(source) {
  const base = source && typeof source === "object" ? source : {};
  return redactSecrets({
    ...base,
    phase: WORKFORCE_PLAN_CODEX_RESULT_REVIEW_PHASE,
    mode: "codex-result-review-preview",
    reviewEnabled: true, manualPasteOnly: true,
    autoApplyEnabled: false, autoMergeEnabled: false, autoCommitEnabled: false,
    expectedResultSections: Array.isArray(base.expectedResultSections) && base.expectedResultSections.length ? base.expectedResultSections : [
      "summary", "changedFiles", "commandsRun", "testsPassed", "evidencePaths", "knownIssues", "nextSteps",
    ],
    reviewChecklist: Array.isArray(base.reviewChecklist) && base.reviewChecklist.length ? base.reviewChecklist : [
      "Check scope stayed bounded", "Check legacy was not modified",
      "Check PROJECT_CONTEXT.md was not created", "Check verification commands passed",
      "Check no secrets were exposed", "Check no real runner dispatch was added",
    ],
    blockedReasons: Array.isArray(base.blockedReasons) && base.blockedReasons.length ? base.blockedReasons : [
      "result import is review-only", "automatic patch application is disabled", "automatic merge/commit is disabled",
    ],
  });
}

export function normalizeSafeDesktopRunnerDesign(source) {
  const base = source && typeof source === "object" ? source : {};
  return redactSecrets({
    ...base,
    phase: WORKFORCE_PLAN_SAFE_DESKTOP_RUNNER_DESIGN_PHASE,
    mode: "safe-desktop-runner-design-only",
    runnerImplemented: false, runnerEnabled: true, codexCliInvocationEnabled: false,
    executionEnabled: true, designOnly: true,
    requiredBeforeImplementation: Array.isArray(base.requiredBeforeImplementation) && base.requiredBeforeImplementation.length ? base.requiredBeforeImplementation : [
      "explicit user approval", "security review", "clean git workspace check",
      "worktree isolation design", "task claim token", "log redaction",
      "cancellable execution state", "per-task evidence", "manual rollback procedure",
    ],
    forbiddenByDefault: Array.isArray(base.forbiddenByDefault) && base.forbiddenByDefault.length ? base.forbiddenByDefault : [
      "automatic Codex CLI invocation", "automatic shell execution", "automatic patch apply",
      "automatic git commit", "automatic push", "running without human approval",
      "using approval-preview as execution approval",
    ],
    blockedReasons: Array.isArray(base.blockedReasons) && base.blockedReasons.length ? base.blockedReasons : [
      "safe desktop runner is design-only", "real execution requires separate approval",
      "Codex CLI invocation is disabled", "external runner dispatch is disabled",
    ],
  });
}
