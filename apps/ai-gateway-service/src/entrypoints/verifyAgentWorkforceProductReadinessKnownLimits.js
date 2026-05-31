import {
  assertEvidencePassed,
  countSecretFindings,
  createDisabledState,
  createSafety,
  noOhMyCodexDependency,
  noProjectContext,
  readWorkspaceTexts,
  writeEvidence,
} from "./verifyAgentWorkforceClosureSupport.js";

const phase = "phase-158a-product-readiness-known-limits";
const suitable = [
  "Requirements breakdown",
  "AI team planning",
  "Role assignment",
  "Review package generation",
  "Approval preview",
  "OMX handoff task package preview",
  "Templated plan generation",
];
const unsuitable = [
  "Automatic code writing",
  "Automatic file changes",
  "Calling oh-my-codex",
  "Creating worktrees",
  "Dispatching a real runner",
  "Public multi-user production deployment",
];

try {
  await assertEvidencePassed("phase-157a-agent-workforce-evidence-index");
  const texts = await readWorkspaceTexts();
  const allText = [texts.rootPackageText, texts.servicePackageText, texts.readme, texts.userManual, texts.agentsDoc].join("\n\n");
  const secretFindingCount = countSecretFindings(allText, phase);
  const checks = {
    prerequisite157Passed: true,
    rootScriptPresent: texts.rootPackage.scripts?.["verify:phase158a-product-readiness-known-limits"]?.includes("verify:phase158a-product-readiness-known-limits"),
    serviceScriptPresent: texts.servicePackage.scripts?.["verify:phase158a-product-readiness-known-limits"] === "node ./src/entrypoints/verifyAgentWorkforceProductReadinessKnownLimits.js",
    suitableUsesPresent: suitable.every((item) => texts.userManual.includes(item) || texts.readme.includes(item)),
    unsuitableUsesPresent: unsuitable.every((item) => texts.userManual.includes(item) || texts.readme.includes(item)),
    noRealExecutionClaim:
      !texts.readme.includes("production-ready execution") &&
      !texts.userManual.includes("runner is implemented") &&
      texts.readme.includes("Execution disabled") &&
      texts.userManual.includes("Execution disabled"),
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
    suitableUses: suitable,
    unsuitableUses: unsuitable,
    disabledState: createDisabledState(),
    safety: createSafety(),
    secretFindingCount,
    conclusion: passed ? "product-readiness-known-limits-hardened" : "product-readiness-known-limits-incomplete",
  });
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  await writeEvidence(phase, {
    phase,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "product-readiness-known-limits-incomplete",
  });
  process.exitCode = 1;
}
