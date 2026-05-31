import {
  assertEvidencePassed,
  countSecretFindings,
  createDisabledState,
  createPreviewPlan,
  createSafety,
  noOhMyCodexDependency,
  noProjectContext,
  readWorkspaceTexts,
  templateIds,
  writeEvidence,
} from "./verifyAgentWorkforceClosureSupport.js";

const phase = "phase-154a-template-acceptance-sample-plans";

try {
  await assertEvidencePassed("phase-153a-agent-workforce-product-template-pack");
  const texts = await readWorkspaceTexts();
  const previewRun = await createPreviewPlan({
    phase,
    selectedTemplate: "research-design-study",
    goal: "Plan a design study comparing two safe export package formats.",
  });
  const plan = previewRun.plan;
  const preview = plan.productTemplatesPreview ?? {};
  const templates = preview.templates ?? [];
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
    JSON.stringify(previewRun),
  ].join("\n\n");
  const secretFindingCount = countSecretFindings(allText, phase);
  const checks = {
    prerequisite153Passed: true,
    rootScriptPresent: texts.rootPackage.scripts?.["verify:phase154a-template-acceptance-sample-plans"]?.includes("verify:phase154a-template-acceptance-sample-plans"),
    serviceScriptPresent: texts.servicePackage.scripts?.["verify:phase154a-template-acceptance-sample-plans"] === "node ./src/entrypoints/verifyAgentWorkforceTemplateAcceptanceSamplePlans.js",
    templateCountValid: templates.length >= 6 && templateIds.every((id) => templates.some((item) => item.id === id)),
    samplePlansPresent: templates.every((item) => item.sampleGoal && item.expectedPlanSections?.length >= 4 && item.sampleAcceptanceChecklist?.length >= 4),
    executionDisabled: preview.executionEnabled === false && templates.every((item) => item.execution === "disabled"),
    saveExportPreservesSamples:
      previewRun.saveResponse.httpStatus === 200 &&
      previewRun.exportResponse.httpStatus === 200 &&
      previewRun.exportResponse.body?.data?.taskPackage?.productTemplatesPreview?.templates?.every((item) => item.sampleGoal && item.execution === "disabled"),
    uiShowsSampleGuidance:
      previewRun.uiResponse.text.includes("Start with a template") &&
      previewRun.uiResponse.text.includes("Demo: feature plan") &&
      previewRun.uiResponse.text.includes("Demo: bug fix"),
    docsMentionSamples:
      texts.userManual.includes("sample plans") &&
      texts.userManual.includes("sample acceptance checklists") &&
      texts.readme.includes("template sample plans"),
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
    templateSamples: templates.map((item) => ({
      id: item.id,
      sampleGoal: item.sampleGoal,
      expectedPlanSectionCount: item.expectedPlanSections?.length ?? 0,
      sampleAcceptanceCount: item.sampleAcceptanceChecklist?.length ?? 0,
      execution: item.execution,
    })),
    disabledState: createDisabledState(),
    safety: createSafety(),
    secretFindingCount,
    conclusion: passed ? "template-acceptance-sample-plans-preview-complete" : "template-acceptance-sample-plans-preview-incomplete",
  });
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  await writeEvidence(phase, {
    phase,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "template-acceptance-sample-plans-preview-incomplete",
  });
  process.exitCode = 1;
}
