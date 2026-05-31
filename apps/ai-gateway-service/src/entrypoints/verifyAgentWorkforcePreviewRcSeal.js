import {
  assertEvidencePassed,
  countSecretFindings,
  createDisabledState,
  createSafety,
  noOhMyCodexDependency,
  noProjectContext,
  readRequired,
  readWorkspaceTexts,
  writeEvidence,
} from "./verifyAgentWorkforceClosureSupport.js";

const phase = "phase-159a-agent-workforce-preview-rc-seal";

try {
  await assertEvidencePassed("phase-158a-product-readiness-known-limits");
  const texts = await readWorkspaceTexts();
  const rcSeal = await readRequired("docs/AGENT_WORKFORCE_PREVIEW_RC_SEAL.md");
  const allText = [texts.rootPackageText, texts.servicePackageText, rcSeal, texts.readme, texts.agentsDoc, texts.userManual].join("\n\n");
  const secretFindingCount = countSecretFindings(allText, phase);
  const checks = {
    prerequisite158Passed: true,
    rootScriptPresent: texts.rootPackage.scripts?.["verify:phase159a-agent-workforce-preview-rc-seal"]?.includes("verify:phase159a-agent-workforce-preview-rc-seal"),
    serviceScriptPresent: texts.servicePackage.scripts?.["verify:phase159a-agent-workforce-preview-rc-seal"] === "node ./src/entrypoints/verifyAgentWorkforcePreviewRcSeal.js",
    rcDocumentPresent: rcSeal.includes("# Agent Workforce Preview RC Seal"),
    baselineCoveragePresent:
      rcSeal.includes("Product template pack") &&
      rcSeal.includes("Template sample plans") &&
      rcSeal.includes("Evidence index"),
    verificationMatrixPresent: rcSeal.includes("Verification Matrix") && rcSeal.includes("verify:phase159a-agent-workforce-preview-rc-seal"),
    blockedExecutionMatrixPresent:
      rcSeal.includes("Blocked Execution Matrix") &&
      rcSeal.includes("real Agent execution: disabled") &&
      rcSeal.includes("external runner dispatch: disabled"),
    noGoConditionsPresent:
      rcSeal.includes("No-Go Conditions") &&
      rcSeal.includes("Do not describe this RC as production-ready execution") &&
      rcSeal.includes("Do not describe the external runner as implemented"),
    docsSynchronized:
      texts.readme.includes("Phase 154A-160A") &&
      texts.agentsDoc.includes("Phase 154A-160A Agent Workforce Preview Product Closure Batch Boundary"),
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
    rcBaseline: "preview product release-candidate baseline only",
    disabledState: createDisabledState(),
    safety: createSafety(),
    secretFindingCount,
    conclusion: passed ? "agent-workforce-preview-rc-seal-complete" : "agent-workforce-preview-rc-seal-incomplete",
  });
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  await writeEvidence(phase, {
    phase,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "agent-workforce-preview-rc-seal-incomplete",
  });
  process.exitCode = 1;
}
