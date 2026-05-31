import {
  assertEvidencePassed,
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

const trialDocs = {
  manualTrial: "docs/AGENT_WORKFORCE_MANUAL_TRIAL_SCRIPT.md",
  feedbackTemplate: "docs/AGENT_WORKFORCE_USER_FEEDBACK_TEMPLATE.md",
  finalClosure: "docs/AGENT_WORKFORCE_FINAL_USER_TRIAL_CLOSURE.md",
};

const phaseDefinitions = {
  "phase-191a-manual-trial-walkthrough": {
    script: "verify:phase191a-manual-trial-walkthrough",
    entrypoint: "verifyAgentWorkforceManualTrialWalkthrough.js",
    prerequisite: "phase-190a-ux-polish-closure",
    docs: [trialDocs.manualTrial],
    needsPlan: true,
    selectedTemplate: "bug-fix",
    goal: "Plan a safe fix for a broken Markdown export button in the web console.",
    conclusion: "manual-trial-walkthrough-complete",
    checks: ({ docs, previewRun }) => {
      const manual = docs[trialDocs.manualTrial] ?? "";
      return {
        manualTrialDocPresent: manual.includes("# Agent Workforce Manual Trial Script"),
        installStartEntryPresent:
          manual.includes("cmd /c pnpm install") &&
          manual.includes("cmd /c pnpm dev:phase7b") &&
          manual.includes("/ui"),
        walkthroughCoversRequiredSteps:
          [
            "Enter the Agent Workforce section",
            "Preview only",
            "Execution Disabled",
            "External Runner Disabled",
            "Choose a template",
            "Enter a demo goal",
            "Generate the Plan",
            "clarification questions",
            "role tiers",
            "consensus preview",
            "Review Package",
            "Approval Preview",
            "OMX Handoff Preview",
            "Execution Readiness",
            "Save the Plan",
            "Open history",
            "Export JSON",
            "Export Markdown",
          ].every((item) => manual.includes(item)),
        noExecutionConfirmationPresent:
          manual.includes("no code was executed") &&
          manual.includes("no OMX CLI was called") &&
          manual.includes("no worktree was created"),
        previewPlanSupportsTrial:
          previewRun.plan.executionReadinessPreflight?.executionEnabled === false &&
          previewRun.plan.externalOmxRunnerDesign?.runnerEnabled === false &&
          Array.isArray(previewRun.plan.clarifyQuestions) &&
          Array.isArray(previewRun.plan.roleTiers) &&
          Array.isArray(previewRun.plan.consensusPreview),
      };
    },
  },
  "phase-192a-user-feedback-template": {
    script: "verify:phase192a-user-feedback-template",
    entrypoint: "verifyAgentWorkforceUserFeedbackTemplate.js",
    prerequisite: "phase-191a-manual-trial-walkthrough",
    docs: [trialDocs.feedbackTemplate],
    conclusion: "user-feedback-template-complete",
    checks: ({ docs }) => {
      const feedback = docs[trialDocs.feedbackTemplate] ?? "";
      return {
        feedbackTemplatePresent: feedback.includes("# Agent Workforce User Feedback Template"),
        metadataFieldsPresent:
          ["Trial person", "Date", "Scenario", "Used template", "Input goal"].every((item) => feedback.includes(item)),
        understandingFieldsPresent:
          [
            "preview-only",
            "Execution Disabled",
            "approval-preview is not execution permission",
            "OMX Handoff Preview is only a handoff package",
          ].every((item) => feedback.includes(item)),
        issueFieldsPresent:
          ["Which step was hardest to understand", "Which wording should be improved", "UI issue", "Export issue"].every((item) => feedback.includes(item)),
        acceptanceStatesPresent:
          ["accepted-preview", "accepted-with-notes", "needs-fix", "rejected-preview"].every((item) => feedback.includes(item)),
        boundaryConfirmationPresent:
          feedback.includes("No real Agent execution was enabled") &&
          feedback.includes("No worktree was created") &&
          feedback.includes("Approval-preview was not treated as execution approval"),
      };
    },
  },
  "phase-193a-small-ux-fix-pass": {
    script: "verify:phase193a-small-ux-fix-pass",
    entrypoint: "verifyAgentWorkforceSmallUxFixPass.js",
    prerequisite: "phase-192a-user-feedback-template",
    docs: [trialDocs.manualTrial, trialDocs.feedbackTemplate],
    conclusion: "small-ux-fix-pass-complete",
    checks: ({ texts, docs }) => ({
      smallUxFixUiPresent:
        texts.ui.includes("phase193a-small-ux-fix-pass") &&
        texts.ui.includes("Manual trial quick path.") &&
        texts.ui.includes("export JSON / Markdown") &&
        texts.ui.includes("no code execution, no OMX call, no worktree creation, no workflow run, and no external runner dispatch"),
      docsSupportTrialAndFeedback:
        (docs[trialDocs.manualTrial] ?? "").includes("UI Walkthrough") &&
        (docs[trialDocs.feedbackTemplate] ?? "").includes("Acceptance Conclusion"),
      noBigCapabilityAdded:
        !texts.ui.includes("id=\"workforce-execute\"") &&
        !texts.ui.includes("Run external runner") &&
        !texts.servicePackageText.includes("oh-my-codex"),
      previewOnlyBoundaryKept:
        texts.ui.includes("Preview only") &&
        texts.ui.includes("Execution Disabled") &&
        texts.ui.includes("External Runner Disabled"),
    }),
  },
  "phase-194a-final-user-trial-closure": {
    script: "verify:phase194a-final-user-trial-closure",
    entrypoint: "verifyAgentWorkforceFinalUserTrialClosure.js",
    prerequisite: "phase-193a-small-ux-fix-pass",
    evidenceRange: [
      "phase-191a-manual-trial-walkthrough",
      "phase-192a-user-feedback-template",
      "phase-193a-small-ux-fix-pass",
    ],
    docs: [trialDocs.manualTrial, trialDocs.feedbackTemplate, trialDocs.finalClosure],
    conclusion: "final-user-trial-closure-complete",
    checks: ({ docs }) => {
      const closure = docs[trialDocs.finalClosure] ?? "";
      return {
        finalClosureDocPresent: closure.includes("# Agent Workforce Final User Trial Closure"),
        requiredSectionsPresent:
          [
            "## Trial Scope",
            "## Walkthrough Path",
            "## Feedback Template",
            "## Small UX Fix Result",
            "## Current Acceptable Conclusion",
            "## Phase 199A Real UI Trial Runtime Sync",
            "## Current Blocker",
            "## No Real Execution Boundary",
            "## Next Options",
            "## Recommended Default Route",
          ].every((item) => closure.includes(item)),
        optionsPresent:
          ["Option A", "Option B", "Option C", "Option D"].every((item) => closure.includes(item)),
        boundaryPresent:
          closure.includes("No real Agent execution") &&
          closure.includes("No oh-my-codex call") &&
          closure.includes("No worktree creation") &&
          closure.includes("No workflow run connection") &&
          closure.includes("No real external runner dispatch") &&
          closure.includes("No default NVIDIA `/chat` lane change"),
        notProductionRelease:
          closure.includes("not a production release") &&
          closure.includes("not a real execution release"),
        phase199aRealBrowserTrialRecorded:
          closure.includes("status=passed-browser-ui-trial") &&
          closure.includes("planId=wfp_03252c967de0") &&
          closure.includes("workforceId=wf_fb1b7f002829") &&
          closure.includes("runtime sync and evidence update only"),
      };
    },
  },
};

export async function runTrialClosureCheck(phase) {
  const definition = phaseDefinitions[phase];
  if (!definition) {
    throw new Error(`Unknown Agent Workforce trial closure phase: ${phase}`);
  }

  try {
    await assertEvidencePassed(definition.prerequisite);
    for (const evidencePhase of definition.evidenceRange ?? []) {
      await assertEvidencePassed(evidencePhase);
    }
    const realUiRuntimeSyncEvidence = phase === "phase-194a-final-user-trial-closure"
      ? await readEvidence("phase-199a-real-ui-trial-runtime-sync")
      : null;
    if (realUiRuntimeSyncEvidence && realUiRuntimeSyncEvidence.status !== "passed-browser-ui-trial") {
      throw new Error("phase-199a-real-ui-trial-runtime-sync evidence must be passed-browser-ui-trial.");
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
        goal: definition.goal ?? "Plan an Agent Workforce Preview manual trial without executing code.",
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
      realUiRuntimeSync: realUiRuntimeSyncEvidence
        ? {
          phase: realUiRuntimeSyncEvidence.phase,
          status: realUiRuntimeSyncEvidence.status,
          browserTrialStatus: realUiRuntimeSyncEvidence.browserTrial?.status,
          uiTrialMode: realUiRuntimeSyncEvidence.browserTrial?.uiTrialMode,
          visitedUrl: realUiRuntimeSyncEvidence.browserTrial?.visitedUrl,
          planId: realUiRuntimeSyncEvidence.browserTrial?.planId,
          workforceId: realUiRuntimeSyncEvidence.browserTrial?.workforceId,
          rootCause: realUiRuntimeSyncEvidence.blockerTriage?.rootCause,
          codeFixRequired: realUiRuntimeSyncEvidence.blockerTriage?.codeFixRequired,
          businessCodeModified: realUiRuntimeSyncEvidence.blockerTriage?.businessCodeModified,
        }
        : undefined,
      disabledState: createDisabledState(),
      safety: createSafety(),
      secretFindingCount,
      conclusion: passed ? definition.conclusion : definition.conclusion.replace(/complete$/, "incomplete"),
      notes: [
        "Phase 191A-194A remains manual trial, feedback, small UX, documentation, and evidence work only.",
        ...(realUiRuntimeSyncEvidence
          ? ["Phase 199A real browser UI trial passed after runtime sync; this records the result only and adds no execution capability."]
          : []),
        "No real Agent execution, no oh-my-codex or OMX call, no worktree creation, no workflow run, no real external runner dispatch.",
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
