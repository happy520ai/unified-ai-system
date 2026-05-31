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

const phase = "phase-155a-template-export-copy-ux";

try {
  await assertEvidencePassed("phase-154a-template-acceptance-sample-plans");
  const texts = await readWorkspaceTexts();
  const previewRun = await createPreviewPlan({
    phase,
    selectedTemplate: "release-checklist",
    goal: "Plan a preview release checklist for Agent Workforce documentation updates.",
  });
  const taskPackage = previewRun.exportResponse.body?.data?.taskPackage ?? {};
  const exported = taskPackage.exportableJson ?? {};
  const markdown = previewRun.exportResponse.body?.data?.markdown ?? taskPackage.markdown ?? "";
  const allText = [
    texts.rootPackageText,
    texts.servicePackageText,
    texts.ui,
    texts.readme,
    texts.userManual,
    JSON.stringify(taskPackage),
    markdown,
  ].join("\n\n");
  const secretFindingCount = countSecretFindings(allText, phase);
  const checks = {
    prerequisite154Passed: true,
    rootScriptPresent: texts.rootPackage.scripts?.["verify:phase155a-template-export-copy-ux"]?.includes("verify:phase155a-template-export-copy-ux"),
    serviceScriptPresent: texts.servicePackage.scripts?.["verify:phase155a-template-export-copy-ux"] === "node ./src/entrypoints/verifyAgentWorkforceTemplateExportCopyUx.js",
    jsonExportPreservesTemplate:
      exported.selectedTemplate?.id === "release-checklist" &&
      exported.templateContext?.sampleAcceptanceChecklist?.length >= 4 &&
      exported.productTemplatesPreview?.executionEnabled === false,
    markdownExportReadable:
      markdown.includes("Product Templates Preview") &&
      markdown.includes("Sample acceptance") &&
      markdown.includes("Execution enabled: false"),
    uiCopyExportWording:
      previewRun.uiResponse.text.includes("Copy/export is handoff only, not execution") &&
      previewRun.uiResponse.text.includes("Execution disabled") &&
      previewRun.uiResponse.text.includes("External Runner disabled"),
    externalRunnerDisabled:
      taskPackage.externalOmxRunnerDesign?.runnerEnabled === false &&
      taskPackage.runnerRequestQueuePreview?.queueEnabled === false &&
      taskPackage.agentWorkforcePreviewFinalUxSeal?.externalRunnerDispatchEnabled === false,
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
    exportSummary: {
      selectedTemplateId: exported.selectedTemplate?.id ?? null,
      executionEnabled: exported.productTemplatesPreview?.executionEnabled ?? null,
      runnerEnabled: taskPackage.externalOmxRunnerDesign?.runnerEnabled ?? null,
    },
    disabledState: createDisabledState(),
    safety: createSafety(),
    secretFindingCount,
    conclusion: passed ? "template-export-copy-ux-preview-complete" : "template-export-copy-ux-preview-incomplete",
  });
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  await writeEvidence(phase, {
    phase,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "template-export-copy-ux-preview-incomplete",
  });
  process.exitCode = 1;
}
