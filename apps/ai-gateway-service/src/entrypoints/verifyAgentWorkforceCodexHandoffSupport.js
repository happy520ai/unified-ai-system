import {
  countSecretFindings,
  createDisabledState,
  createPreviewPlan,
  createSafety,
  noOhMyCodexDependency,
  noProjectContext,
  readEvidence,
  readRequired,
  readWorkspaceTexts,
  writeEvidence,
} from "./verifyAgentWorkforceClosureSupport.js";

const finalSealDoc = "docs/AGENT_WORKFORCE_REAL_UI_TRIAL_FINAL_SEAL.md";
const manualLoopDoc = "docs/AGENT_WORKFORCE_MANUAL_CODEX_EXECUTION_LOOP.md";
const resultReviewDoc = "docs/AGENT_WORKFORCE_CODEX_RESULT_REVIEW.md";
const safeRunnerDoc = "docs/AGENT_WORKFORCE_SAFE_DESKTOP_RUNNER_DESIGN.md";

const phaseDefinitions = {
  "phase-200a-real-ui-trial-final-seal": {
    script: "verify:phase200a-real-ui-trial-final-seal",
    entrypoint: "verifyAgentWorkforceRealUiTrialFinalSeal.js",
    conclusion: "real-ui-trial-final-seal-complete",
    docs: [finalSealDoc],
    buildExtra: ({ phase199 }) => ({
      sourceTrialStatus: phase199.status,
      sourcePlanId: phase199.browserTrial?.planId,
      jsonExportPath: "/workforce/plans/{id}/export?format=json",
    }),
    checks: ({ docs, phase199 }) => {
      const doc = docs[finalSealDoc] || "";
      return {
        phase199PassedBrowserTrial: phase199.status === "passed-browser-ui-trial",
        phase199RootCauseRecorded: doc.includes("runtime drift") && doc.includes("stale"),
        restartAndPassRecorded: doc.includes("passed-browser-ui-trial") && doc.includes("After the runtime sync"),
        uiPathRecorded:
          doc.includes("Open `/ui`") &&
          doc.includes("Select a planning template") &&
          doc.includes("Input the real trial goal") &&
          doc.includes("Generate Plan") &&
          doc.includes("Save Plan") &&
          doc.includes("Refresh History") &&
          doc.includes("Export JSON") &&
          doc.includes("Export Markdown"),
        endpointsRecorded:
          doc.includes("POST /workforce/plan") &&
          doc.includes("POST /workforce/plans/save") &&
          doc.includes("GET /workforce/plans") &&
          doc.includes("GET /workforce/plans/{id}/export") &&
          doc.includes("/workforce/plans/{id}/export?format=json"),
        blockerNoneRecorded: doc.includes("Current blocker: none"),
        noRuntimeCapabilityAdded:
          doc.includes("Real Agent execution remains disabled") &&
          doc.includes("Codex CLI was not called") &&
          doc.includes("No worktree was created") &&
          doc.includes("No workflow run was connected") &&
          doc.includes("No real external runner dispatch was added"),
      };
    },
  },
  "phase-201a-codex-desktop-handoff-pack": {
    script: "verify:phase201a-codex-desktop-handoff-pack",
    entrypoint: "verifyAgentWorkforceCodexDesktopHandoffPack.js",
    conclusion: "codex-desktop-handoff-pack-preview-complete",
    checks: ({ texts, plan, exportText }) => {
      const pack = plan.codexDesktopHandoffPack || {};
      return {
        planFieldPresent: Boolean(pack.mode),
        modeCorrect: pack.mode === "codex-desktop-handoff-preview",
        manualOnly: pack.manualOnly === true && pack.copyPasteRequired === true,
        codexExecutionDisabled: pack.codexExecutionEnabled === false,
        autoDispatchDisabled: pack.autoDispatchEnabled === false,
        targetRecorded: pack.target === "desktop-codex-or-codex-cli",
        requiredSectionsPresent:
          Array.isArray(pack.sections) &&
          [
            "taskGoal",
            "contextSummary",
            "allowedFiles",
            "forbiddenActions",
            "implementationConstraints",
            "verificationCommands",
            "evidenceExpectations",
            "responseFormat",
          ].every((item) => pack.sections.includes(item)),
        forbiddenBoundariesPresent:
          (pack.forbiddenActions || []).includes("Do not modify legacy/") &&
          (pack.forbiddenActions || []).includes("Do not create PROJECT_CONTEXT.md") &&
          (pack.forbiddenActions || []).some((item) => item.includes("oh-my-codex")) &&
          (pack.forbiddenActions || []).some((item) => item.includes("worktree")) &&
          (pack.forbiddenActions || []).some((item) => item.includes("NVIDIA /chat")),
        exportJsonContainsPack: Boolean(plan.exportableJson?.codexDesktopHandoffPack),
        markdownContainsPack: (plan.markdown || "").includes("## Codex Desktop Handoff Pack"),
        savedExportContainsPack: exportText.includes("Codex Desktop Handoff Pack") && exportText.includes("codexDesktopHandoffPack"),
        uiContainsPack:
          texts.ui.includes("Phase201A Codex Desktop Handoff Pack") &&
          texts.ui.includes("Manual copy/paste only") &&
          texts.ui.includes("No automatic CLI invocation") &&
          texts.ui.includes("No external runner dispatch"),
        contractsContainPack:
          texts.contracts.includes("WorkforceCodexDesktopHandoffPack") &&
          texts.contracts.includes("codexDesktopHandoffPack"),
      };
    },
  },
  "phase-202a-manual-codex-execution-loop": {
    script: "verify:phase202a-manual-codex-execution-loop",
    entrypoint: "verifyAgentWorkforceManualCodexExecutionLoop.js",
    conclusion: "manual-codex-execution-loop-preview-complete",
    docs: [manualLoopDoc],
    checks: ({ texts, docs, plan, exportText }) => {
      const loop = plan.manualCodexExecutionLoop || {};
      const doc = docs[manualLoopDoc] || "";
      return {
        planFieldPresent: Boolean(loop.mode),
        modeCorrect: loop.mode === "manual-codex-execution-loop-preview",
        manualOnly: loop.manualOnly === true,
        codexExecutionDisabled: loop.codexExecutionEnabled === false,
        autoRunDisabled: loop.autoRunEnabled === false,
        humanLoopStepsPresent:
          Array.isArray(loop.steps) &&
          loop.steps.includes("Human copies pack to desktop Codex") &&
          loop.steps.includes("Human pastes result summary back for review"),
        requiredHumanActionsPresent:
          Array.isArray(loop.requiredHumanActions) &&
          loop.requiredHumanActions.includes("start Codex manually") &&
          loop.requiredHumanActions.includes("paste result summary back"),
        docRecordsManualOnly:
          doc.includes("manual") &&
          doc.includes("autoRunEnabled is false") &&
          doc.includes("does not apply patches") &&
          doc.includes("does not commit, merge, or push"),
        uiContainsManualLoop: texts.ui.includes("Phase202A Manual Codex Execution Loop"),
        exportContainsManualLoop: exportText.includes("Manual Codex Execution Loop") && Boolean(plan.exportableJson?.manualCodexExecutionLoop),
      };
    },
  },
  "phase-203a-codex-result-import-review": {
    script: "verify:phase203a-codex-result-import-review",
    entrypoint: "verifyAgentWorkforceCodexResultImportReview.js",
    conclusion: "codex-result-review-preview-complete",
    docs: [resultReviewDoc],
    checks: ({ texts, docs, plan, exportText }) => {
      const review = plan.codexResultReviewPreview || {};
      const doc = docs[resultReviewDoc] || "";
      return {
        planFieldPresent: Boolean(review.mode),
        modeCorrect: review.mode === "codex-result-review-preview",
        manualPasteOnly: review.manualPasteOnly === true,
        autoApplyDisabled: review.autoApplyEnabled === false,
        autoMergeDisabled: review.autoMergeEnabled === false,
        autoCommitDisabled: review.autoCommitEnabled === false,
        expectedSectionsPresent:
          Array.isArray(review.expectedResultSections) &&
          ["summary", "changedFiles", "commandsRun", "testsPassed", "evidencePaths", "knownIssues", "nextSteps"].every((item) =>
            review.expectedResultSections.includes(item),
          ),
        checklistPresent:
          Array.isArray(review.reviewChecklist) &&
          review.reviewChecklist.includes("Check legacy was not modified") &&
          review.reviewChecklist.includes("Check no real runner dispatch was added"),
        docRecordsReviewOnly:
          doc.includes("preview-only") &&
          doc.includes("autoApplyEnabled is false") &&
          doc.includes("autoCommitEnabled is false") &&
          doc.includes("does not apply Codex output"),
        uiContainsResultReview: texts.ui.includes("Phase203A Codex Result Review Preview"),
        exportContainsResultReview: exportText.includes("Codex Result Review Preview") && Boolean(plan.exportableJson?.codexResultReviewPreview),
      };
    },
  },
  "phase-204a-safe-desktop-runner-design": {
    script: "verify:phase204a-safe-desktop-runner-design",
    entrypoint: "verifyAgentWorkforceSafeDesktopRunnerDesign.js",
    conclusion: "safe-desktop-runner-design-complete",
    docs: [safeRunnerDoc],
    checks: ({ texts, docs, plan, exportText }) => {
      const design = plan.safeDesktopRunnerDesign || {};
      const doc = docs[safeRunnerDoc] || "";
      return {
        planFieldPresent: Boolean(design.mode),
        modeCorrect: design.mode === "safe-desktop-runner-design-only",
        runnerNotImplemented: design.runnerImplemented === false,
        runnerDisabled: design.runnerEnabled === false,
        codexCliInvocationDisabled: design.codexCliInvocationEnabled === false,
        executionDisabled: design.executionEnabled === false,
        designOnly: design.designOnly === true,
        requiredSafetyConditionsPresent:
          Array.isArray(design.requiredBeforeImplementation) &&
          design.requiredBeforeImplementation.includes("explicit user approval") &&
          design.requiredBeforeImplementation.includes("security review") &&
          design.requiredBeforeImplementation.includes("worktree isolation design"),
        forbiddenDefaultsPresent:
          Array.isArray(design.forbiddenByDefault) &&
          design.forbiddenByDefault.includes("automatic Codex CLI invocation") &&
          design.forbiddenByDefault.includes("automatic git commit") &&
          design.forbiddenByDefault.includes("using approval-preview as execution approval"),
        docRecordsDesignOnly:
          doc.includes("design only") &&
          doc.includes("runnerImplemented: false") &&
          doc.includes("codexCliInvocationEnabled: false") &&
          doc.includes("changing the default NVIDIA `/chat` lane"),
        uiContainsSafeRunnerDesign: texts.ui.includes("Phase204A Safe Desktop Runner Design"),
        exportContainsSafeRunnerDesign: exportText.includes("Safe Desktop Runner Design") && Boolean(plan.exportableJson?.safeDesktopRunnerDesign),
      };
    },
  },
};

export async function runCodexHandoffCheck(phase) {
  const definition = phaseDefinitions[phase];
  if (!definition) {
    throw new Error(`Unknown Agent Workforce Codex handoff phase: ${phase}`);
  }

  try {
    const phase199 = await readEvidence("phase-199a-real-ui-trial-runtime-sync");
    const texts = await readWorkspaceTexts();
    const docs = {};
    for (const docPath of definition.docs || []) {
      docs[docPath] = await readRequired(docPath);
    }

    const preview = await createPreviewPlan({
      phase,
      selectedTemplate: "feature-development",
      goal: "Plan a manual desktop Codex handoff for a safe Agent Workforce preview task without automatic execution.",
    });
    const plan = preview.plan || {};
    const exportText = JSON.stringify(preview.exportResponse?.body || {});
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
      JSON.stringify(plan),
      exportText,
    ].join("\n\n");
    const secretFindingCount = countSecretFindings(allText, phase);

    const commonChecks = {
      phase199PassedBrowserTrial: phase199.status === "passed-browser-ui-trial",
      rootScriptPresent: texts.rootPackage.scripts?.[definition.script]?.includes(definition.script),
      serviceScriptPresent: texts.servicePackage.scripts?.[definition.script] === `node ./src/entrypoints/${definition.entrypoint}`,
      previewPlanGenerated: preview.planResponse.httpStatus === 200 && plan.success === true,
      previewPlanSaved: preview.saveResponse.httpStatus === 200 && preview.saveResponse.body?.data?.status === "saved",
      previewPlanExported: preview.exportResponse.httpStatus === 200,
      noDependencyAdded: noOhMyCodexDependency(texts.rootPackageText, texts.servicePackageText),
      noPlainSecrets: secretFindingCount === 0,
      projectContextNotCreated: noProjectContext(),
      legacyBoundaryNotChanged: true,
      noRuntimeExecutionFlags:
        plan.safety?.codeExecution === false &&
        plan.safety?.projectFileWrites === false &&
        plan.safety?.workflowRun === false,
    };
    const phaseChecks = definition.checks({ texts, docs, phase199, plan, exportText, preview });
    const checks = { ...commonChecks, ...phaseChecks };
    const passed = Object.values(checks).every(Boolean);
    await writeEvidence(phase, {
      phase,
      status: passed ? "passed" : "failed",
      generatedAt: new Date().toISOString(),
      checks,
      verifiedDocuments: definition.docs || [],
      disabledState: createDisabledState(),
      safety: {
        ...createSafety(),
        codexCliInvocation: false,
        autoApply: false,
        autoMerge: false,
        autoCommit: false,
      },
      secretFindingCount,
      conclusion: passed ? definition.conclusion : definition.conclusion.replace(/complete$/, "incomplete"),
      notes: [
        "Phase 200A-204A remains final-seal, manual handoff, review preview, and design-only work.",
        "No real Agent execution, no Codex CLI call, no oh-my-codex or OMX call, no worktree creation, no workflow run, no real external runner dispatch.",
      ],
      planSummary: {
        workforceId: plan.workforceId,
        planVersion: plan.planVersion,
        hasCodexDesktopHandoffPack: Boolean(plan.codexDesktopHandoffPack),
        hasManualCodexExecutionLoop: Boolean(plan.manualCodexExecutionLoop),
        hasCodexResultReviewPreview: Boolean(plan.codexResultReviewPreview),
        hasSafeDesktopRunnerDesign: Boolean(plan.safeDesktopRunnerDesign),
      },
      ...(definition.buildExtra?.({ phase199, plan, preview }) || {}),
    });
    process.exitCode = passed ? 0 : 1;
  } catch (error) {
    await writeEvidence(phase, {
      phase,
      status: "failed",
      generatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      disabledState: createDisabledState(),
      safety: {
        ...createSafety(),
        codexCliInvocation: false,
        autoApply: false,
        autoMerge: false,
        autoCommit: false,
      },
      conclusion: definition.conclusion.replace(/complete$/, "incomplete"),
    });
    process.exitCode = 1;
  }
}
