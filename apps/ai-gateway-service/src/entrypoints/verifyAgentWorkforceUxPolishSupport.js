import {
  assertEvidencePassed,
  countSecretFindings,
  createDisabledState,
  createPreviewPlan,
  createSafety,
  noOhMyCodexDependency,
  noProjectContext,
  readRequired,
  readWorkspaceTexts,
  writeEvidence,
} from "./verifyAgentWorkforceClosureSupport.js";

const canonicalTerms = [
  "Agent Workforce Preview",
  "Plan",
  "Review Package",
  "Approval Preview",
  "OMX Handoff Preview",
  "External Runner Disabled",
  "Execution Disabled",
];

const boundaryBannerTerms = [
  "Preview only",
  "Execution Disabled",
  "External Runner Disabled",
  "No oh-my-codex call",
  "No worktree creation",
];

const phaseDefinitions = {
  "phase-181a-empty-state-first-use-guidance": {
    script: "verify:phase181a-empty-state-first-use-guidance",
    entrypoint: "verifyAgentWorkforceEmptyStateFirstUseGuidance.js",
    prerequisite: "phase-180a-final-product-decision-gate",
    conclusion: "empty-state-first-use-guidance-polish-complete",
    checks: ({ texts }) => ({
      firstUseGuidancePresent:
        texts.ui.includes("phase181a-empty-state-first-use-guidance") &&
        texts.ui.includes("Agent Workforce Preview is ready for a first Plan.") &&
        texts.ui.includes("First-use guidance: start with a template and a short goal."),
      exampleGoalsPresent:
        texts.ui.includes("Plan a safe Bug Fix for a broken Markdown export button") &&
        texts.ui.includes("Plan a Documentation update for a user handoff package") &&
        texts.ui.includes("Plan a Release Checklist for a preview baseline review"),
      executionDisabledCopyPresent:
        texts.ui.includes("Execution Disabled") &&
        texts.ui.includes("External Runner Disabled"),
      noRuntimeExecutionEntry:
        !texts.ui.includes("executionEnabled: true") &&
        !texts.ui.includes("externalRunnerDispatchEnabled: true"),
    }),
  },
  "phase-182a-error-validation-ux": {
    script: "verify:phase182a-error-validation-ux",
    entrypoint: "verifyAgentWorkforceErrorValidationUx.js",
    prerequisite: "phase-181a-empty-state-first-use-guidance",
    conclusion: "error-validation-ux-polish-complete",
    checks: ({ texts }) => ({
      validationCodesPresent:
        ["WORKFORCE_GOAL_REQUIRED", "WORKFORCE_GOAL_TOO_LONG", "WORKFORCE_TEMPLATE_INVALID"].every((item) => texts.ui.includes(item)),
      readableMessagesPresent:
        texts.ui.includes("Goal is too long. Shorten it to 1000 characters or less before generating a Plan. Execution Disabled.") &&
        texts.ui.includes("Template selection is not recognized. Please choose one of the listed Agent Workforce Preview templates. Execution Disabled."),
      noStackOrSecretNoticePresent:
        texts.ui.includes("No stack trace, no API key, and no real execution are exposed by this validation message."),
      noExecutionTriggered:
        !texts.ui.includes("runAgent(") &&
        !texts.ui.includes("spawnRealAgent"),
    }),
  },
  "phase-183a-terminology-consistency": {
    script: "verify:phase183a-terminology-consistency",
    entrypoint: "verifyAgentWorkforceTerminologyConsistency.js",
    prerequisite: "phase-182a-error-validation-ux",
    conclusion: "terminology-consistency-polish-complete",
    checks: ({ texts }) => {
      const combined = `${texts.ui}\n${texts.readme}\n${texts.userManual}`;
      return {
        canonicalTermsPresent: canonicalTerms.every((item) => combined.includes(item)),
        terminologySectionPresent:
          texts.ui.includes("Phase183A Terminology Consistency") &&
          texts.readme.includes("Canonical terms are") &&
          texts.userManual.includes("The canonical terms in the UI are"),
      };
    },
  },
  "phase-184a-export-handoff-wording": {
    script: "verify:phase184a-export-handoff-wording",
    entrypoint: "verifyAgentWorkforceExportHandoffWording.js",
    prerequisite: "phase-183a-terminology-consistency",
    needsPlan: true,
    selectedTemplate: "release-checklist",
    goal: "Plan a preview release checklist for Agent Workforce documentation updates.",
    conclusion: "export-handoff-wording-polish-complete",
    checks: ({ texts, previewRun }) => ({
      exportExplanationPresent:
        texts.planner.includes("## Export / Handoff Explanation") &&
        texts.store.includes("## Export / Handoff Explanation") &&
        texts.ui.includes("## Export / Handoff Explanation"),
      handoffNotExecution:
        previewRun.plan.markdown.includes("Export is a handoff package for human review, not an execution package.") &&
        previewRun.plan.markdown.includes("Suggested OMX commands are text only and are not executed.") &&
        previewRun.plan.markdown.includes("approval-preview is not execution approval."),
      executionFlagPreserved:
        previewRun.plan.markdown.includes("executionEnabled=false") &&
        previewRun.plan.executionReadinessPreflight?.executionEnabled === false,
    }),
  },
  "phase-185a-accessibility-readability": {
    script: "verify:phase185a-accessibility-readability",
    entrypoint: "verifyAgentWorkforceAccessibilityReadability.js",
    prerequisite: "phase-184a-export-handoff-wording",
    conclusion: "accessibility-readability-polish-complete",
    checks: ({ texts }) => ({
      readableClassesPresent:
        texts.ui.includes(".workforce-banner") &&
        texts.ui.includes(".workforce-badge") &&
        texts.ui.includes(".workforce-readable"),
      labelsAndStatesPresent:
        texts.ui.includes("aria-label=\"Agent Workforce safety status\"") &&
        texts.ui.includes("Goal length") &&
        texts.ui.includes("Execution Disabled"),
      noComplexUiDependency:
        !texts.rootPackageText.includes("@radix-ui") &&
        !texts.servicePackageText.includes("@radix-ui") &&
        !texts.rootPackageText.includes("material-ui"),
    }),
  },
  "phase-186a-demo-goal-copy-polish": {
    script: "verify:phase186a-demo-goal-copy-polish",
    entrypoint: "verifyAgentWorkforceDemoGoalCopyPolish.js",
    prerequisite: "phase-185a-accessibility-readability",
    conclusion: "demo-goal-copy-polish-complete",
    checks: ({ texts }) => ({
      demoCopySectionPresent:
        texts.ui.includes("phase186a-demo-goal-copy-polish") &&
        texts.ui.includes("Demo Goal Copy Polish: each demo has a recommended template and use case."),
      recommendedTemplatesPresent:
        [
          "Feature Development",
          "Bug Fix",
          "Documentation",
          "Code Review",
          "Release Checklist",
          "Research / Design Study",
        ].every((item) => texts.ui.includes(item)),
      demoPlanOnlyCopyPresent:
        texts.ui.includes("Demo goals only generate a Plan. They do not execute code.") &&
        texts.userManual.includes("They do not execute Agents"),
    }),
  },
  "phase-187a-history-detail-polish": {
    script: "verify:phase187a-history-detail-polish",
    entrypoint: "verifyAgentWorkforceHistoryDetailPolish.js",
    prerequisite: "phase-186a-demo-goal-copy-polish",
    needsPlan: true,
    selectedTemplate: "code-review",
    goal: "Plan a code review for a UI export change without executing code.",
    conclusion: "history-detail-polish-complete",
    checks: ({ texts, previewRun }) => ({
      historyPolishPresent:
        texts.ui.includes("phase187a-history-detail-polish") &&
        texts.ui.includes("selectedTemplate") &&
        texts.ui.includes("createdAt") &&
        texts.ui.includes("plan state") &&
        texts.ui.includes("no execution button is provided"),
      executionDisabledInHistory:
        texts.ui.includes("Execution Disabled. History offers load, export, and delete controls only; no execution button is provided.") &&
        previewRun.plan.safety?.codeExecution === false,
      noExecutionButton:
        !texts.ui.includes("id=\"workforce-execute\"") &&
        !texts.ui.includes("Run external runner"),
    }),
  },
  "phase-188a-boundary-banner-safety-notice": {
    script: "verify:phase188a-boundary-banner-safety-notice",
    entrypoint: "verifyAgentWorkforceBoundaryBannerSafetyNotice.js",
    prerequisite: "phase-187a-history-detail-polish",
    conclusion: "boundary-banner-safety-notice-polish-complete",
    checks: ({ texts }) => {
      const combinedDocs = `${texts.readme}\n${texts.userManual}`;
      return {
        boundaryBannerPresent:
          texts.ui.includes("phase188a-boundary-banner-safety-notice") &&
          texts.ui.includes("Preview only safety notice."),
        uiBoundaryTermsPresent: boundaryBannerTerms.every((item) => texts.ui.includes(item)),
        docsBoundaryTermsPresent: boundaryBannerTerms.every((item) => combinedDocs.includes(item)),
      };
    },
  },
  "phase-189a-microcopy-regression-pack": {
    script: "verify:phase189a-microcopy-regression-pack",
    entrypoint: "verifyAgentWorkforceMicrocopyRegressionPack.js",
    prerequisite: "phase-188a-boundary-banner-safety-notice",
    evidenceRange: [
      "phase-181a-empty-state-first-use-guidance",
      "phase-182a-error-validation-ux",
      "phase-183a-terminology-consistency",
      "phase-184a-export-handoff-wording",
      "phase-185a-accessibility-readability",
      "phase-186a-demo-goal-copy-polish",
      "phase-187a-history-detail-polish",
      "phase-188a-boundary-banner-safety-notice",
    ],
    conclusion: "microcopy-regression-pack-complete",
    checks: ({ texts }) => {
      const combined = `${texts.ui}\n${texts.readme}\n${texts.userManual}\n${texts.agentsDoc}`;
      return {
        keyMicrocopyPresent:
          canonicalTerms.every((item) => combined.includes(item)) &&
          boundaryBannerTerms.every((item) => combined.includes(item)) &&
          combined.includes("approval-preview is not execution approval"),
        noMisleadingExecutionReadyCopy:
          !combined.includes("is production-ready execution") &&
          !combined.includes("execution-ready release") &&
          !combined.includes("approval-preview is execution approval") &&
          !combined.includes("external runner is implemented"),
        noRealExecutionBoundaryHeld:
          combined.includes("does not execute code") &&
          combined.includes("does not call oh-my-codex") &&
          combined.includes("does not create worktrees"),
      };
    },
  },
  "phase-190a-ux-polish-closure": {
    script: "verify:phase190a-ux-polish-closure",
    entrypoint: "verifyAgentWorkforceUxPolishClosure.js",
    prerequisite: "phase-189a-microcopy-regression-pack",
    docs: ["docs/AGENT_WORKFORCE_UX_POLISH_CLOSURE.md"],
    conclusion: "ux-polish-closure-complete",
    checks: ({ docs }) => {
      const closure = docs["docs/AGENT_WORKFORCE_UX_POLISH_CLOSURE.md"] ?? "";
      return {
        closureDocPresent: closure.includes("# Agent Workforce UX Polish Closure"),
        completedItemsPresent:
          ["Phase 181A", "Phase 182A", "Phase 183A", "Phase 184A", "Phase 185A", "Phase 186A", "Phase 187A", "Phase 188A", "Phase 189A", "Phase 190A"].every((item) => closure.includes(item)),
        modifiedScopePresent: closure.includes("## Modified Scope"),
        noNewCapabilityPresent: closure.includes("## No New Capability") && closure.includes("does not add a new runtime capability"),
        boundariesKeptPresent:
          closure.includes("## Boundaries Kept") &&
          closure.includes("Execution Disabled") &&
          closure.includes("External Runner Disabled") &&
          closure.includes("Suggested OMX commands are text only"),
        nextRecommendationPresent: closure.includes("## Next Recommendation"),
      };
    },
  },
};

export async function runUxPolishCheck(phase) {
  const definition = phaseDefinitions[phase];
  if (!definition) {
    throw new Error(`Unknown Agent Workforce UX polish phase: ${phase}`);
  }

  try {
    await assertEvidencePassed(definition.prerequisite);
    for (const evidencePhase of definition.evidenceRange ?? []) {
      await assertEvidencePassed(evidencePhase);
    }

    const texts = await readWorkspaceTexts();
    const docs = {};
    for (const docPath of definition.docs ?? []) {
      docs[docPath] = await readRequired(docPath);
    }

    const previewRun = definition.needsPlan
      ? await createPreviewPlan({
        phase,
        selectedTemplate: definition.selectedTemplate ?? "feature-development",
        goal: definition.goal ?? "Plan Agent Workforce Preview UX polish without executing code.",
      })
      : null;

    const allText = [
      texts.rootPackageText,
      texts.servicePackageText,
      texts.contracts,
      texts.planner,
      texts.store,
      texts.ui,
      texts.readme,
      texts.agentsDoc,
      texts.userManual,
      ...Object.values(docs),
      JSON.stringify(previewRun ?? {}),
    ].join("\n\n");
    const secretFindingCount = countSecretFindings(allText, phase);

    const checks = {
      prerequisitePassed: true,
      rootScriptPresent: texts.rootPackage.scripts?.[definition.script]?.includes(definition.script),
      serviceScriptPresent: texts.servicePackage.scripts?.[definition.script] === `node ./src/entrypoints/${definition.entrypoint}`,
      noDependencyAdded: noOhMyCodexDependency(texts.rootPackageText, texts.servicePackageText),
      noPlainSecrets: secretFindingCount === 0,
      projectContextNotCreated: noProjectContext(),
      ...definition.checks({ texts, docs, previewRun }),
    };

    const passed = Object.values(checks).every(Boolean);
    await writeEvidence(phase, {
      phase,
      status: passed ? "passed" : "failed",
      generatedAt: new Date().toISOString(),
      checks,
      verifiedDocuments: definition.docs ?? [],
      prerequisite: definition.prerequisite,
      disabledState: createDisabledState(),
      safety: createSafety(),
      secretFindingCount,
      conclusion: passed ? definition.conclusion : definition.conclusion.replace(/complete$/, "incomplete"),
      notes: [
        "Phase 181A-190A remains UI / experience / documentation / evidence polish only.",
        "No real Agent execution, no oh-my-codex call, no worktree creation, no workflow run, no real external runner dispatch.",
      ],
    });
    process.exitCode = passed ? 0 : 1;
  } catch (error) {
    await writeEvidence(phase, {
      phase,
      status: "failed",
      generatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      disabledState: createDisabledState(),
      safety: createSafety(),
      conclusion: definition.conclusion.replace(/complete$/, "incomplete"),
    });
    process.exitCode = 1;
  }
}
