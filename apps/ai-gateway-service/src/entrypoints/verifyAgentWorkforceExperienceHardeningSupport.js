import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertEvidencePassed,
  countSecretFindings,
  createDisabledState,
  createPreviewPlan,
  createSafety,
  evidencePhases142To156,
  evidencePhases157To160,
  evidencePhases161To180,
  noOhMyCodexDependency,
  noProjectContext,
  readRequired,
  readWorkspaceTexts,
  repoRoot,
  templateIds,
  writeEvidence,
} from "./verifyAgentWorkforceClosureSupport.js";

const demoGoals = [
  "Plan a customer-facing export settings feature with reviewable acceptance criteria.",
  "Plan a safe fix for a broken Markdown export button in the web console.",
  "Plan a user manual section for exporting Agent Workforce task packages.",
  "Plan a code review for a UI export change without executing code.",
  "Plan a preview release checklist for Agent Workforce documentation updates.",
  "Plan a design study comparing two safe export package formats.",
];

const phases142To160 = [...evidencePhases142To156, ...evidencePhases157To160];
const phases142To170 = [...phases142To160, ...evidencePhases161To180.slice(0, 10)];
const phases142To173 = [...phases142To160, ...evidencePhases161To180.slice(0, 13)];
const phases142To178 = [...phases142To160, ...evidencePhases161To180.slice(0, 18)];

const commonDocPaths = {
  verificationMatrix: "docs/AGENT_WORKFORCE_VERIFICATION_MATRIX.md",
  localRunbook: "docs/AGENT_WORKFORCE_LOCAL_OPERATOR_RUNBOOK.md",
  manualQa: "docs/AGENT_WORKFORCE_MANUAL_QA_CHECKLIST.md",
  finalManifest: "docs/AGENT_WORKFORCE_EVIDENCE_MANIFEST_FINAL.md",
  rc2Seal: "docs/AGENT_WORKFORCE_PREVIEW_RC2_SEAL.md",
  docIndex: "docs/AGENT_WORKFORCE_DOC_INDEX.md",
  userHandoff: "docs/AGENT_WORKFORCE_USER_HANDOFF_PACKAGE.md",
  decisionGate: "docs/AGENT_WORKFORCE_FINAL_PRODUCT_DECISION_GATE.md",
};

const definitions = {
  "phase-161a-ui-information-architecture": {
    script: "verify:phase161a-ui-information-architecture",
    entrypoint: "verifyAgentWorkforceUiInformationArchitecture.js",
    prerequisite: "phase-160a-agent-workforce-final-closure",
    needsPlan: true,
    goal: demoGoals[0],
    conclusion: "ui-information-architecture-preview-complete",
    checks: ({ texts, previewRun }) => ({
      uiOverviewPresent:
        texts.ui.includes("phase161a-ui-information-architecture") &&
        previewRun.uiResponse.text.includes("Agent Workforce Preview overview") &&
        previewRun.uiResponse.text.includes("preview-only"),
      planningHandoffConsoleClear:
        previewRun.uiResponse.text.includes("Plan / Clarify / Roles / Consensus / Review / Approval Preview") &&
        previewRun.uiResponse.text.includes("OMX Handoff Preview") &&
        previewRun.uiResponse.text.includes("External Runner Preview"),
      executionAndRunnerDisabledCopy:
        previewRun.uiResponse.text.includes("Execution Disabled") &&
        previewRun.uiResponse.text.includes("External Runner Disabled"),
      noExecutionEntry:
        !texts.ui.includes("externalRunnerDispatchEnabled: true") &&
        !texts.ui.includes("executionEnabled: true"),
    }),
  },
  "phase-162a-workforce-dashboard-summary-cards": {
    script: "verify:phase162a-workforce-dashboard-summary-cards",
    entrypoint: "verifyAgentWorkforceDashboardSummaryCards.js",
    prerequisite: "phase-161a-ui-information-architecture",
    needsPlan: true,
    goal: demoGoals[0],
    conclusion: "dashboard-summary-cards-preview-complete",
    checks: ({ texts, previewRun }) => ({
      summaryCardsPresent:
        texts.ui.includes("phase162a-workforce-dashboard-summary-cards") &&
        [
          "Plan State",
          "Clarification",
          "Role Tiers",
          "Consensus",
          "Review Package",
          "Approval Gate Preview",
          "OMX Handoff Preview",
          "Execution Readiness",
          "External Runner Disabled",
        ].every((item) => previewRun.uiResponse.text.includes(item)),
      summaryCardsReadOnly: previewRun.uiResponse.text.includes("Dashboard Summary Cards are read-only"),
      executionDisabled: previewRun.plan.executionReadinessPreflight?.executionEnabled === false,
      runnerDisabled: previewRun.plan.externalOmxRunnerDesign?.runnerEnabled === false,
      noRealExecutionEntry:
        !texts.ui.includes("dispatchEnabled: true") &&
        !texts.ui.includes("real Agent execution is enabled"),
    }),
  },
  "phase-163a-template-gallery-ux": {
    script: "verify:phase163a-template-gallery-ux",
    entrypoint: "verifyAgentWorkforceTemplateGalleryUx.js",
    prerequisite: "phase-162a-workforce-dashboard-summary-cards",
    needsPlan: true,
    goal: demoGoals[1],
    selectedTemplate: "bug-fix",
    conclusion: "template-gallery-ux-preview-complete",
    checks: ({ texts, previewRun }) => {
      const templates = previewRun.plan.productTemplatesPreview?.templates ?? [];
      return {
        galleryPresent: texts.ui.includes("phase163a-template-gallery-ux"),
        templateCountValid: templates.length >= 6 && templateIds.every((id) => templates.some((item) => item.id === id)),
        scenarioFocusOutputsPresent:
          ["Scenario:", "Focus:", "Expected outputs:", "execution disabled"].every((item) => texts.ui.includes(item)),
        executionDisabled:
          previewRun.plan.productTemplatesPreview?.executionEnabled === false &&
          templates.every((item) => item.execution === "disabled"),
      };
    },
  },
  "phase-164a-plan-output-readability": {
    script: "verify:phase164a-plan-output-readability",
    entrypoint: "verifyAgentWorkforcePlanOutputReadability.js",
    prerequisite: "phase-163a-template-gallery-ux",
    needsPlan: true,
    goal: demoGoals[2],
    selectedTemplate: "documentation",
    conclusion: "plan-output-readability-preview-complete",
    checks: ({ texts, previewRun }) => ({
      planOutputStructurePresent:
        texts.ui.includes("Phase164A Plan Output Structure") &&
        [
          "Goal Summary",
          "Clarification Questions",
          "Role Plan",
          "Role Tiers",
          "Consensus Preview",
          "Review Package",
          "Acceptance Checklist",
          "OMX Handoff Preview",
          "Execution Readiness",
          "External Runner Preview",
        ].every((item) => texts.ui.includes(item)),
      markdownStructurePresent:
        previewRun.plan.markdown.includes("## Summary") &&
        previewRun.plan.markdown.includes("## Clarification Questions") &&
        previewRun.plan.markdown.includes("## Handoff Package Manifest"),
      executionDisabled:
        previewRun.plan.safety?.codeExecution === false &&
        previewRun.plan.executionReadinessPreflight?.executionEnabled === false,
    }),
  },
  "phase-165a-review-approval-handoff-clarity": {
    script: "verify:phase165a-review-approval-handoff-clarity",
    entrypoint: "verifyAgentWorkforceReviewApprovalHandoffClarity.js",
    prerequisite: "phase-164a-plan-output-readability",
    needsPlan: true,
    goal: demoGoals[4],
    selectedTemplate: "release-checklist",
    conclusion: "review-approval-handoff-clarity-preview-complete",
    checks: ({ texts, previewRun }) => ({
      clarityUiPresent:
        texts.ui.includes("Phase165A Review / Approval / Handoff Clarity") &&
        texts.ui.includes("Review package is human review material, not execution.") &&
        texts.ui.includes("approval-preview is not execution approval.") &&
        texts.ui.includes("Suggested OMX commands are text only and are not executed."),
      approvalPreviewNotExecutionPermission:
        previewRun.plan.executionApprovalRecordPreview?.approvalPolicy?.approvalPreviewIsExecutionPermission === false,
      omxCommandsTextOnly:
        Array.isArray(previewRun.plan.omxHandoffPreview?.suggestedOmxCommands) &&
        previewRun.plan.omxHandoffPreview.suggestedOmxCommands.length >= 3 &&
        previewRun.plan.omxHandoffPreview?.runsOhMyCodex === false,
      executionDisabled: previewRun.plan.omxHandoffPreview?.executionEnabled === false,
    }),
  },
  "phase-166a-saved-plans-history-ux": {
    script: "verify:phase166a-saved-plans-history-ux",
    entrypoint: "verifyAgentWorkforceSavedPlansHistoryUx.js",
    prerequisite: "phase-165a-review-approval-handoff-clarity",
    needsPlan: true,
    goal: demoGoals[3],
    selectedTemplate: "code-review",
    conclusion: "saved-plans-history-ux-preview-complete",
    checks: ({ texts, previewRun }) => ({
      historyCopyPresent:
        texts.ui.includes("Saved plans / history UX hardening (Phase166A)") &&
        texts.ui.includes("selected template") &&
        texts.ui.includes("createdAt") &&
        texts.ui.includes("plan state") &&
        texts.ui.includes("execution: "),
      summaryFieldsPresent:
        texts.store.includes("selectedTemplate: plan.selectedTemplate?.name") &&
        texts.store.includes('execution: "disabled"') &&
        texts.store.includes("createdAt: plan.createdAt"),
      saveDoesNotTriggerExecution:
        previewRun.saveResponse.httpStatus === 200 &&
        previewRun.plan.safety?.codeExecution === false &&
        previewRun.plan.safety?.workflowRun === false,
    }),
  },
  "phase-167a-export-handoff-package-manifest": {
    script: "verify:phase167a-export-handoff-package-manifest",
    entrypoint: "verifyAgentWorkforceExportHandoffPackageManifest.js",
    prerequisite: "phase-166a-saved-plans-history-ux",
    needsPlan: true,
    goal: demoGoals[0],
    selectedTemplate: "feature-development",
    conclusion: "export-handoff-package-manifest-preview-complete",
    checks: ({ texts, previewRun }) => {
      const manifest = previewRun.exportResponse.body?.data?.taskPackage?.handoffPackageManifest;
      return {
        manifestPlannerStoreContractPresent:
          texts.planner.includes("createHandoffPackageManifest") &&
          texts.store.includes("normalizeHandoffPackageManifest") &&
          texts.contracts.includes("WorkforceHandoffPackageManifest"),
        exportManifestPresent:
          previewRun.exportResponse.httpStatus === 200 &&
          manifest?.mode === "handoff-package-manifest-preview" &&
          manifest?.executionEnabled === false &&
          manifest?.runnerEnabled === false,
        manifestSectionsPresent:
          Array.isArray(manifest?.includedSections) &&
          ["plan metadata", "selected template", "role tiers", "review package", "approval preview", "omx handoff preview", "execution readiness"].every((item) => manifest.includedSections.includes(item)),
        markdownManifestPresent:
          previewRun.exportResponse.body?.data?.taskPackage?.markdown?.includes("## Handoff Package Manifest"),
      };
    },
  },
  "phase-168a-guided-demo-mode-polish": {
    script: "verify:phase168a-guided-demo-mode-polish",
    entrypoint: "verifyAgentWorkforceGuidedDemoModePolish.js",
    prerequisite: "phase-167a-export-handoff-package-manifest",
    needsPlan: true,
    goal: demoGoals[5],
    selectedTemplate: "research-design-study",
    conclusion: "guided-demo-mode-polish-preview-complete",
    checks: ({ texts, previewRun }) => ({
      guidedDemoUiPresent:
        texts.ui.includes("phase168a-guided-demo-mode-polish") &&
        texts.ui.includes("Guided Demo Mode") &&
        texts.ui.includes("recommended template"),
      demoGoalCountValid:
        (texts.ui.match(/Demo:/g) ?? []).length >= 6 &&
        (previewRun.plan.productTemplatesPreview?.demoGoals ?? []).length >= 6,
      demoGoalsInManual: demoGoals.every((goal) => texts.userManual.includes(goal)),
      templatesAssociated:
        ["Feature Development template", "Bug Fix template", "Documentation template", "Code Review template", "Release Checklist template", "Research / Design Study template"].every((item) => texts.ui.includes(item)),
      executionDisabled: previewRun.plan.productTemplatesPreview?.executionEnabled === false,
    }),
  },
  "phase-169a-user-manual-navigation": {
    script: "verify:phase169a-user-manual-navigation",
    entrypoint: "verifyAgentWorkforceUserManualNavigation.js",
    prerequisite: "phase-168a-guided-demo-mode-polish",
    conclusion: "user-manual-navigation-preview-complete",
    checks: ({ texts }) => ({
      manualNavigationPresent:
        texts.userManual.includes("Agent Workforce Navigation Hardening") &&
        [
          "Start from zero",
          "Open /ui",
          "Choose a template",
          "Generate a plan",
          "Save history",
          "Export JSON / Markdown",
          "View handoff package",
          "Understand execution disabled",
        ].every((item) => texts.userManual.includes(item)),
    }),
  },
  "phase-170a-readme-agents-boundary-sync": {
    script: "verify:phase170a-readme-agents-boundary-sync",
    entrypoint: "verifyAgentWorkforceReadmeAgentsBoundarySync.js",
    prerequisite: "phase-169a-user-manual-navigation",
    conclusion: "readme-agents-boundary-sync-preview-complete",
    checks: ({ texts }) => ({
      readmeBoundaryPresent:
        texts.readme.includes("Phase 161A-180A") &&
        texts.readme.includes("preview product baseline") &&
        texts.readme.includes("Execution disabled") &&
        texts.readme.includes("External Runner disabled"),
      agentsLongTermBoundaryPresent:
        texts.agentsDoc.includes("Phase 161A-180A Agent Workforce Preview Product Experience / Delivery Hardening Boundary") &&
        texts.agentsDoc.includes("do not default into real execution") &&
        texts.agentsDoc.includes("do not call oh-my-codex") &&
        texts.agentsDoc.includes("do not create worktrees") &&
        texts.agentsDoc.includes("do not connect workflow run") &&
        texts.agentsDoc.includes("do not change the default NVIDIA `/chat` lane"),
      noMisleadingExecutionReadyCopy:
        !texts.readme.includes("production-ready execution") &&
        !texts.agentsDoc.includes("approval-preview is execution approval"),
    }),
  },
  "phase-171a-verification-matrix": {
    script: "verify:phase171a-verification-matrix",
    entrypoint: "verifyAgentWorkforceVerificationMatrix.js",
    prerequisite: "phase-170a-readme-agents-boundary-sync",
    docs: [commonDocPaths.verificationMatrix],
    conclusion: "verification-matrix-preview-complete",
    checks: ({ docs }) => {
      const matrix = docs[commonDocPaths.verificationMatrix] ?? "";
      return {
        verificationMatrixPresent: matrix.includes("# Agent Workforce Verification Matrix"),
        phases142To170Listed: phases142To170.every((item) => matrix.includes(`verify:${item.replace(/^phase-/, "phase")}`) || matrix.includes(item)),
        aggregateCommandPresent: matrix.includes("verify:agent-workforce-preview-baseline"),
        noRealExecutionLanguage: matrix.includes("does not execute real Agents") && matrix.includes("does not call oh-my-codex"),
      };
    },
  },
  "phase-172a-local-operator-runbook": {
    script: "verify:phase172a-local-operator-runbook",
    entrypoint: "verifyAgentWorkforceLocalOperatorRunbook.js",
    prerequisite: "phase-171a-verification-matrix",
    docs: [commonDocPaths.localRunbook],
    conclusion: "local-operator-runbook-preview-complete",
    checks: ({ docs }) => {
      const runbook = docs[commonDocPaths.localRunbook] ?? "";
      return {
        runbookPresent: runbook.includes("# Agent Workforce Local Operator Runbook"),
        runbookCoversOperations:
          ["Install dependencies", "Start", "Stop", "Status", "Health", "Doctor", "Open /ui", "Agent Workforce verification", "Common questions"].every((item) => runbook.includes(item)),
        boundaryPresent: runbook.includes("does not execute code") && runbook.includes("preview-only"),
      };
    },
  },
  "phase-173a-manual-qa-checklist": {
    script: "verify:phase173a-manual-qa-checklist",
    entrypoint: "verifyAgentWorkforceManualQaChecklist.js",
    prerequisite: "phase-172a-local-operator-runbook",
    docs: [commonDocPaths.manualQa],
    conclusion: "manual-qa-checklist-preview-complete",
    checks: ({ docs }) => {
      const checklist = docs[commonDocPaths.manualQa] ?? "";
      return {
        checklistPresent: checklist.includes("# Agent Workforce Manual QA Checklist"),
        checklistCoversRequiredItems:
          ["UI opens", "Template selection", "Plan generation", "Role tiers", "Clarification", "Consensus", "Review package", "Approval preview", "OMX handoff preview", "Execution readiness blocked", "External runner disabled", "Save/history", "Export JSON/Markdown", "No real execution"].every((item) => checklist.includes(item)),
      };
    },
  },
  "phase-174a-evidence-manifest-final": {
    script: "verify:phase174a-evidence-manifest-final",
    entrypoint: "verifyAgentWorkforceEvidenceManifestFinal.js",
    prerequisite: "phase-173a-manual-qa-checklist",
    evidenceRange: phases142To173,
    docs: [commonDocPaths.finalManifest],
    conclusion: "evidence-manifest-final-preview-complete",
    checks: ({ docs }) => {
      const manifest = docs[commonDocPaths.finalManifest] ?? "";
      return {
        manifestPresent: manifest.includes("# Agent Workforce Evidence Manifest Final"),
        evidence142To173Listed: phases142To173.every((item) => manifest.includes(`${item}.json`)),
        statusAndBoundaryPresent: manifest.includes("Status") && manifest.includes("Disabled boundary") && manifest.includes("Execution remains disabled"),
      };
    },
  },
  "phase-175a-agent-workforce-preview-rc2-seal": {
    script: "verify:phase175a-agent-workforce-preview-rc2-seal",
    entrypoint: "verifyAgentWorkforcePreviewRc2Seal.js",
    prerequisite: "phase-174a-evidence-manifest-final",
    docs: [commonDocPaths.rc2Seal],
    conclusion: "agent-workforce-preview-rc2-seal-complete",
    checks: ({ docs, texts }) => {
      const seal = docs[commonDocPaths.rc2Seal] ?? "";
      return {
        rc2SealPresent: seal.includes("# Agent Workforce Preview RC2 Seal"),
        rc2ScopeCorrect:
          seal.includes("preview product baseline") &&
          seal.includes("not a production execution release") &&
          seal.includes("not a runner release") &&
          seal.includes("not an oh-my-codex integration release"),
        docsSynchronized: texts.readme.includes("RC2 seal") && texts.agentsDoc.includes("Phase 161A-180A"),
      };
    },
  },
  "phase-176a-install-start-use-path": {
    script: "verify:phase176a-install-start-use-path",
    entrypoint: "verifyAgentWorkforceInstallStartUsePath.js",
    prerequisite: "phase-175a-agent-workforce-preview-rc2-seal",
    conclusion: "install-start-use-path-preview-complete",
    checks: ({ texts }) => ({
      localUsePathPresent:
        ["pnpm install", "pnpm dev:phase7b", "/ui", "Agent Workforce", "choose a template", "generate", "save", "export"].every((item) =>
          `${texts.readme}\n${texts.userManual}`.toLowerCase().includes(item.toLowerCase()),
        ),
      noNewDeployMainline:
        texts.readme.includes("No Docker / cloud / CI/CD expansion") &&
        texts.userManual.includes("No Docker / cloud / CI/CD expansion"),
    }),
  },
  "phase-177a-documentation-crosslink-index": {
    script: "verify:phase177a-documentation-crosslink-index",
    entrypoint: "verifyAgentWorkforceDocCrosslinkIndex.js",
    prerequisite: "phase-176a-install-start-use-path",
    docs: [commonDocPaths.docIndex],
    conclusion: "documentation-crosslink-index-preview-complete",
    checks: ({ docs }) => {
      const index = docs[commonDocPaths.docIndex] ?? "";
      return {
        docIndexPresent: index.includes("# Agent Workforce Documentation Index"),
        requiredDocsLinked:
          [
            "USER_MANUAL",
            "DEMO_SCRIPT",
            "ACCEPTANCE_PACK",
            "STAGE_CLOSURE_DECISION",
            "EVIDENCE_INDEX",
            "VERIFICATION_MATRIX",
            "LOCAL_OPERATOR_RUNBOOK",
            "MANUAL_QA_CHECKLIST",
            "FINAL_CLOSURE_SNAPSHOT",
            "RC_SEAL",
            "RC2_SEAL",
          ].every((item) => index.includes(item)),
      };
    },
  },
  "phase-178a-user-handoff-package": {
    script: "verify:phase178a-user-handoff-package",
    entrypoint: "verifyAgentWorkforceUserHandoffPackage.js",
    prerequisite: "phase-177a-documentation-crosslink-index",
    docs: [commonDocPaths.userHandoff],
    conclusion: "user-handoff-package-preview-complete",
    checks: ({ docs }) => {
      const handoff = docs[commonDocPaths.userHandoff] ?? "";
      return {
        handoffPackagePresent: handoff.includes("# Agent Workforce User Handoff Package"),
        handoffCoversRequiredItems:
          ["What it can do", "What it cannot do", "How to start", "How to demo", "How to accept", "How to export plans", "How to understand OMX handoff preview", "Next-stage decision"].every((item) => handoff.includes(item)),
        boundaryPresent: handoff.includes("Execution disabled") && handoff.includes("External Runner disabled"),
      };
    },
  },
  "phase-179a-full-preview-regression-sweep": {
    script: "verify:phase179a-full-preview-regression-sweep",
    entrypoint: "verifyAgentWorkforceFullPreviewRegressionSweep.js",
    prerequisite: "phase-178a-user-handoff-package",
    evidenceRange: phases142To178,
    docs: Object.values(commonDocPaths),
    conclusion: "full-preview-regression-sweep-complete",
    checks: ({ docs, texts }) => ({
      keyDocsPresent: Object.values(commonDocPaths).every((path) => docs[path]?.length > 0),
      keyEvidencePresent: phases142To178.every((item) => existsSync(resolve(repoRoot, `apps/ai-gateway-service/evidence/${item}.json`))),
      keyScriptsPresent: [
        "verify:phase161a-ui-information-architecture",
        "verify:phase170a-readme-agents-boundary-sync",
        "verify:phase178a-user-handoff-package",
      ].every((item) => texts.rootPackage.scripts?.[item] && texts.servicePackage.scripts?.[item]),
      noRealExecution:
        !texts.servicePackageText.includes("oh-my-codex") &&
        !texts.ui.includes("externalRunnerDispatchEnabled: true"),
    }),
  },
  "phase-180a-final-product-decision-gate": {
    script: "verify:phase180a-final-product-decision-gate",
    entrypoint: "verifyAgentWorkforceFinalProductDecisionGate.js",
    prerequisite: "phase-179a-full-preview-regression-sweep",
    docs: [commonDocPaths.decisionGate],
    conclusion: "final-product-decision-gate-complete",
    checks: ({ docs }) => {
      const gate = docs[commonDocPaths.decisionGate] ?? "";
      return {
        decisionGatePresent: gate.includes("# Agent Workforce Final Product Decision Gate"),
        finalStatePresent: gate.includes("Current final state") && gate.includes("preview product baseline"),
        completedSectionsPresent:
          ["Completed capabilities", "Completed documentation", "Completed evidence", "Current blocker", "No real execution boundary"].every((item) => gate.includes(item)),
        optionsPresent: ["Option A", "Option B", "Option C", "Option D", "Recommended default route"].every((item) => gate.includes(item)),
      };
    },
  },
};

export async function runExperienceHardeningCheck(phase) {
  const definition = definitions[phase];
  if (!definition) {
    throw new Error(`Unknown Agent Workforce experience hardening phase: ${phase}`);
  }
  try {
    await assertEvidencePassed(definition.prerequisite);
    if (definition.evidenceRange) {
      await Promise.all(definition.evidenceRange.map((item) => assertEvidencePassed(item)));
    }
    const texts = await readWorkspaceTexts();
    const docs = {};
    for (const path of definition.docs ?? []) {
      docs[path] = await readRequired(path);
    }
    const previewRun = definition.needsPlan
      ? await createPreviewPlan({
        phase,
        selectedTemplate: definition.selectedTemplate ?? "feature-development",
        goal: definition.goal ?? demoGoals[0],
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
    const phaseChecks = definition.checks({ texts, docs, previewRun });
    const checks = {
      prerequisitePassed: true,
      rootScriptPresent: texts.rootPackage.scripts?.[definition.script]?.includes(definition.script),
      serviceScriptPresent: texts.servicePackage.scripts?.[definition.script] === `node ./src/entrypoints/${definition.entrypoint}`,
      noDependencyAdded: noOhMyCodexDependency(texts.rootPackageText, texts.servicePackageText),
      noPlainSecrets: secretFindingCount === 0,
      projectContextNotCreated: noProjectContext(),
      ...phaseChecks,
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
      conclusion: definitions[phase]?.conclusion?.replace(/complete$/, "incomplete") ?? "agent-workforce-experience-hardening-incomplete",
    });
    process.exitCode = 1;
  }
}

