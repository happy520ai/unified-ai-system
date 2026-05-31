import {
  assertEvidencePassed,
  countSecretFindings,
  createDisabledState,
  createSafety,
  evidencePhases142To156,
  noOhMyCodexDependency,
  noProjectContext,
  readRequired,
  readWorkspaceTexts,
  writeEvidence,
} from "./verifyAgentWorkforceClosureSupport.js";

const phase = "phase-157a-agent-workforce-evidence-index";

try {
  await assertEvidencePassed("phase-156a-guided-onboarding-demo-dataset");
  const priorEvidence = await Promise.all(evidencePhases142To156.map((item) => assertEvidencePassed(item)));
  const texts = await readWorkspaceTexts();
  const evidenceIndex = await readRequired("docs/AGENT_WORKFORCE_EVIDENCE_INDEX.md");
  const allText = [texts.rootPackageText, texts.servicePackageText, evidenceIndex, texts.readme, texts.agentsDoc, texts.userManual].join("\n\n");
  const secretFindingCount = countSecretFindings(allText, phase);
  const checks = {
    prerequisite156Passed: true,
    priorEvidence142To156Passed: priorEvidence.every((item) => item.status === "passed"),
    rootScriptPresent: texts.rootPackage.scripts?.["verify:phase157a-agent-workforce-evidence-index"]?.includes("verify:phase157a-agent-workforce-evidence-index"),
    serviceScriptPresent: texts.servicePackage.scripts?.["verify:phase157a-agent-workforce-evidence-index"] === "node ./src/entrypoints/verifyAgentWorkforceEvidenceIndex.js",
    indexDocumentPresent: evidenceIndex.includes("# Agent Workforce Evidence Index"),
    evidenceIndexComplete: evidencePhases142To156.every((item) => evidenceIndex.includes(`${item}.json`)),
    verificationCommandsPresent:
      evidenceIndex.includes("cmd /c pnpm verify:phase157a-agent-workforce-evidence-index") &&
      evidenceIndex.includes("cmd /c pnpm -r --if-present check"),
    capabilityAndBoundarySplit:
      evidenceIndex.includes("Product Capabilities") &&
      evidenceIndex.includes("Disabled Boundaries") &&
      evidenceIndex.includes("Execution remains disabled"),
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
    indexedEvidence: evidencePhases142To156.map((item) => `apps/ai-gateway-service/evidence/${item}.json`),
    disabledState: createDisabledState(),
    safety: createSafety(),
    secretFindingCount,
    conclusion: passed ? "agent-workforce-evidence-index-preview-complete" : "agent-workforce-evidence-index-preview-incomplete",
  });
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  await writeEvidence(phase, {
    phase,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "agent-workforce-evidence-index-preview-incomplete",
  });
  process.exitCode = 1;
}
