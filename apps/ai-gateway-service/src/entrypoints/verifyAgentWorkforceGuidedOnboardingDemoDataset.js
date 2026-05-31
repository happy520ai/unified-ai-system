import {
  assertEvidencePassed,
  countSecretFindings,
  createDisabledState,
  createPreviewPlan,
  createSafety,
  noOhMyCodexDependency,
  noProjectContext,
  readWorkspaceTexts,
  writeEvidence,
} from "./verifyAgentWorkforceClosureSupport.js";

const phase = "phase-156a-guided-onboarding-demo-dataset";
const demoGoals = [
  "Plan a customer-facing export settings feature with reviewable acceptance criteria.",
  "Plan a safe fix for a broken Markdown export button in the web console.",
  "Plan a user manual section for exporting Agent Workforce task packages.",
  "Plan a preview release checklist for Agent Workforce documentation updates.",
  "Plan a design study comparing two safe export package formats.",
];

try {
  await assertEvidencePassed("phase-155a-template-export-copy-ux");
  const texts = await readWorkspaceTexts();
  const previewRun = await createPreviewPlan({
    phase,
    selectedTemplate: "documentation",
    goal: demoGoals[2],
  });
  const allText = [
    texts.rootPackageText,
    texts.servicePackageText,
    texts.ui,
    texts.readme,
    texts.userManual,
    JSON.stringify(previewRun.plan.productTemplatesPreview),
  ].join("\n\n");
  const secretFindingCount = countSecretFindings(allText, phase);
  const normalizedManual = texts.userManual.replace(/\s+/g, " ");
  const checks = {
    prerequisite155Passed: true,
    rootScriptPresent: texts.rootPackage.scripts?.["verify:phase156a-guided-onboarding-demo-dataset"]?.includes("verify:phase156a-guided-onboarding-demo-dataset"),
    serviceScriptPresent: texts.servicePackage.scripts?.["verify:phase156a-guided-onboarding-demo-dataset"] === "node ./src/entrypoints/verifyAgentWorkforceGuidedOnboardingDemoDataset.js",
    startWithTemplateUiPresent:
      previewRun.uiResponse.text.includes("Start with a template") &&
      previewRun.uiResponse.text.includes("Demo: documentation") &&
      previewRun.uiResponse.text.includes("Demo: release checklist"),
    demoGoalsInManual: demoGoals.every((goal) => normalizedManual.includes(goal)),
    demoGoalsInPlan: (previewRun.plan.productTemplatesPreview?.demoGoals ?? []).length >= 6,
    executionDisabled:
      previewRun.plan.productTemplatesPreview?.executionEnabled === false &&
      previewRun.plan.safety?.codeExecution === false &&
      previewRun.plan.safety?.workflowRun === false,
    noDependencyAdded: noOhMyCodexDependency(texts.rootPackageText, texts.servicePackageText),
    noPlainSecrets: secretFindingCount === 0,
    projectContextNotCreated: noProjectContext(),
  };
  const passed = Object.values(checks).every(Boolean);
  await writeEvidence(phase, {
    phase,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    checks,
    demoGoals,
    disabledState: createDisabledState(),
    safety: createSafety(),
    secretFindingCount,
    conclusion: passed ? "guided-onboarding-demo-dataset-preview-complete" : "guided-onboarding-demo-dataset-preview-incomplete",
  });
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  await writeEvidence(phase, {
    phase,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "guided-onboarding-demo-dataset-preview-incomplete",
  });
  process.exitCode = 1;
}
