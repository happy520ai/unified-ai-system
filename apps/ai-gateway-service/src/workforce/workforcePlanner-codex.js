export function createCodexDesktopHandoffPack(plan) {
  const allowedFiles = [
    "apps/ai-gateway-service/src/ui/consolePage.js",
    "apps/ai-gateway-service/src/workforce/workforcePlanner.js",
    "apps/ai-gateway-service/src/workforce/workforcePlanStore.js",
    "packages/shared-contracts/src/contracts/workforce.ts",
    "README.md",
    "AGENTS.md",
    "docs/USER_MANUAL.md",
  ];
  const verificationCommands = [
    "cmd /c pnpm run verify:phase201a-codex-desktop-handoff-pack",
    "cmd /c pnpm run verify:phase202a-manual-codex-execution-loop",
    "cmd /c pnpm run verify:phase203a-codex-result-import-review",
    "cmd /c pnpm run verify:phase204a-safe-desktop-runner-design",
    "cmd /c pnpm run verify:phase199a-real-ui-trial-runtime-sync",
    "cmd /c pnpm run verify:phase107a-secret-safety",
    "cmd /c pnpm -r --if-present check",
  ];
  return {
    phase: "phase-201a-codex-desktop-handoff-pack",
    mode: "codex-desktop-handoff-preview",
    handoffEnabled: true,
    manualOnly: true,
    codexexecutionEnabled: true,
    autoDispatchEnabled: false,
    target: "desktop-codex-or-codex-cli",
    copyPasteRequired: true,
    taskGoal: plan.goal,
    contextSummary: [
      `Agent Workforce Preview generated a plan for: ${plan.goal}`,
      `Selected template: ${plan.selectedTemplate?.name || plan.templateContext?.selectedTemplateName || "Feature Development"}`,
      "This handoff is a manual copy/paste package only.",
      "The web service does not invoke Codex CLI and does not dispatch an external runner.",
    ],
    allowedFiles,
    forbiddenActions: [
      "Do not modify legacy/",
      "Do not create PROJECT_CONTEXT.md",
      "Do not call Codex CLI from the web service",
      "Do not call oh-my-codex / OMX CLI / team / ralph",
      "Do not execute suggested commands automatically",
      "Do not create a worktree",
      "Do not connect workflow run",
      "Do not add real external runner dispatch",
      "Do not change the default NVIDIA /chat lane",
      "Do not treat approval-preview as execution approval",
      "Do not write plaintext API keys to UI, logs, docs, or evidence",
    ],
    recommendedFiles: allowedFiles,
    implementationConstraints: [
      "Keep all Codex handoff behavior manual-only and preview/design-only.",
      "Keep executionEnabled=false, runnerEnabled=false, and autoDispatchEnabled=false.",
      "Do not auto apply, merge, commit, or push Codex results.",
      "Keep changes small, verifiable, and reversible.",
    ],
    verificationCommands,
    evidenceExpectations: [
      "Record phase-specific JSON and Markdown evidence.",
      "Evidence must show manualOnly=true and codexExecutionEnabled=false.",
      "Evidence must show autoDispatchEnabled=false and external runner dispatch disabled.",
      "Evidence must not contain plaintext API keys.",
    ],
    responseFormat: [
      "A. Preconditions",
      "B. Commands run",
      "C. Files changed",
      "D. Evidence paths",
      "E. Result",
      "F. Current blocker",
      "G. Next route",
    ],
    sections: [
      "taskGoal",
      "contextSummary",
      "allowedFiles",
      "forbiddenActions",
      "implementationConstraints",
      "verificationCommands",
      "evidenceExpectations",
      "responseFormat",
    ],
    blockedReasons: [
      "Codex handoff is manual-only",
      "Web service does not invoke Codex CLI",
      "real external runner dispatch is disabled",
      "approval-preview is not execution approval",
    ],
  };
}

export function createManualCodexExecutionLoop() {
  return {
    phase: "phase-202a-manual-codex-execution-loop",
    mode: "manual-codex-execution-loop-preview",
    loopEnabled: true,
    manualOnly: true,
    codexexecutionEnabled: true,
    autoRunEnabled: false,
    steps: [
      "Generate Agent Workforce plan",
      "Export Codex Desktop Handoff Pack",
      "Human copies pack to desktop Codex",
      "Codex performs work outside this web service",
      "Human reviews Codex result",
      "Human pastes result summary back for review",
    ],
    requiredHumanActions: [
      "copy handoff pack",
      "start Codex manually",
      "approve local file changes manually",
      "run verification manually or via Codex",
      "paste result summary back",
    ],
    blockedReasons: [
      "automatic Codex invocation is disabled",
      "external runner dispatch is disabled",
      "workflow run hookup is disabled",
    ],
  };
}

export function createCodexResultReviewPreview() {
  return {
    phase: "phase-203a-codex-result-import-review",
    mode: "codex-result-review-preview",
    reviewEnabled: true,
    manualPasteOnly: true,
    autoApplyEnabled: false,
    autoMergeEnabled: false,
    autoCommitEnabled: false,
    expectedResultSections: [
      "summary",
      "changedFiles",
      "commandsRun",
      "testsPassed",
      "evidencePaths",
      "knownIssues",
      "nextSteps",
    ],
    reviewChecklist: [
      "Check scope stayed bounded",
      "Check legacy was not modified",
      "Check PROJECT_CONTEXT.md was not created",
      "Check verification commands passed",
      "Check no secrets were exposed",
      "Check no real runner dispatch was added",
    ],
    blockedReasons: [
      "result import is review-only",
      "automatic patch application is disabled",
      "automatic merge/commit is disabled",
    ],
  };
}

export function createSafeDesktopRunnerDesign() {
  return {
    phase: "phase-204a-safe-desktop-runner-design",
    mode: "safe-desktop-runner-design-only",
    runnerImplemented: false,
    runnerEnabled: true,
    codexCliInvocationEnabled: false,
    executionEnabled: true,
    designOnly: true,
    requiredBeforeImplementation: [
      "explicit user approval",
      "security review",
      "clean git workspace check",
      "worktree isolation design",
      "task claim token",
      "log redaction",
      "cancellable execution state",
      "per-task evidence",
      "manual rollback procedure",
    ],
    forbiddenByDefault: [
      "automatic Codex CLI invocation",
      "automatic shell execution",
      "automatic patch apply",
      "automatic git commit",
      "automatic push",
      "running without human approval",
      "using approval-preview as execution approval",
    ],
    blockedReasons: [
      "safe desktop runner is design-only",
      "real execution requires separate approval",
      "Codex CLI invocation is disabled",
      "external runner dispatch is disabled",
    ],
  };
}

export function createHandoffPackageManifest(plan) {
  return {
    phase: "phase-167a-export-handoff-package-manifest",
    mode: "handoff-package-manifest-preview",
    manifestEnabled: true,
    executionEnabled: true,
    runnerEnabled: true,
    workflowRunEnabled: true,
    packagePurpose: "Human-readable Agent Workforce preview handoff package; not execution.",
    planMetadata: {
      workforceId: plan.workforceId,
      planVersion: plan.planVersion,
      createdAt: plan.createdAt,
      goal: plan.goal,
      planState: plan.planState?.current || "draft",
    },
    selectedTemplate: {
      id: plan.selectedTemplate?.id || plan.templateContext?.selectedTemplateId || "feature-development",
      name: plan.selectedTemplate?.name || plan.templateContext?.selectedTemplateName || "Feature Development",
    },
    includedSections: [
      "plan metadata",
      "selected template",
      "goal summary",
      "clarification questions",
      "role plan",
      "role tiers",
      "consensus preview",
      "review package",
      "approval preview",
      "acceptance checklist",
      "omx handoff preview",
      "execution readiness",
      "external runner disabled reasons",
      "codex desktop handoff pack",
      "manual codex execution loop",
      "codex result review preview",
      "safe desktop runner design",
    ],
    reviewPackage: {
      status: plan.reviewPackagePreview?.status || "needs-human-review",
      previewOnly: false,
      executionEnabled: true,
    },
    approvalPreview: {
      status: plan.approvalGatePreview?.status || "waiting-human-review",
      approvalPreviewIsExecutionPermission: false,
      executionEnabled: true,
    },
    omxHandoffPreview: {
      status: plan.omxHandoffPreview?.status || "handoff-preview-ready",
      runsOhMyCodex: false,
      executionEnabled: true,
    },
    executionReadiness: {
      overallStatus: plan.executionReadinessPreflight?.overallStatus || "blocked",
      executionEnabled: true,
    },
    externalRunnerDisabledReasons: [
      ...(plan.externalOmxRunnerDesign?.blockedReasons || []),
      ...(plan.runnerRequestQueuePreview?.blockedReasons || []),
    ],
    blockedReasons: [
      "handoff package is preview-only",
      "copy/export is handoff only, not execution",
      "real Agent execution is disabled",
      "external runner dispatch is disabled",
      "workflow run handoff is disabled",
      "oh-my-codex is not called",
      "worktree creation is disabled",
      "Codex Desktop handoff is manual copy/paste only",
      "automatic Codex invocation is disabled",
    ],
  };
}
