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

const phase = "phase-160a-agent-workforce-final-closure";
const completedCapabilities = [
  "target clarification",
  "role planning",
  "role tiers",
  "consensus review",
  "review package",
  "approval preview",
  "OMX handoff preview",
  "execution readiness preflight",
  "external runner design preview",
  "request queue preview",
  "approval record preview",
  "protocol freeze",
  "template pack",
  "sample plans",
  "export experience",
  "user acceptance pack",
  "evidence index",
  "RC seal",
  "final closure snapshot",
];

try {
  await assertEvidencePassed("phase-159a-agent-workforce-preview-rc-seal");
  const texts = await readWorkspaceTexts();
  const finalSnapshot = await readRequired("docs/AGENT_WORKFORCE_FINAL_CLOSURE_SNAPSHOT.md");
  const normalizedSnapshot = finalSnapshot.toLowerCase().replace(/\s+/g, " ");
  const allText = [texts.rootPackageText, texts.servicePackageText, finalSnapshot, texts.readme, texts.agentsDoc, texts.userManual].join("\n\n");
  const secretFindingCount = countSecretFindings(allText, phase);
  const checks = {
    prerequisite159Passed: true,
    rootScriptPresent: texts.rootPackage.scripts?.["verify:phase160a-agent-workforce-final-closure"]?.includes("verify:phase160a-agent-workforce-final-closure"),
    serviceScriptPresent: texts.servicePackage.scripts?.["verify:phase160a-agent-workforce-final-closure"] === "node ./src/entrypoints/verifyAgentWorkforceFinalClosure.js",
    snapshotDocumentPresent: finalSnapshot.includes("# Agent Workforce Final Closure Snapshot"),
    completedCapabilitiesPresent: completedCapabilities.every((item) => normalizedSnapshot.includes(item.toLowerCase())),
    finalBoundariesPresent:
      finalSnapshot.includes("No real Agent execution") &&
      finalSnapshot.includes("No oh-my-codex call") &&
      finalSnapshot.includes("No worktree creation") &&
      finalSnapshot.includes("No workflow run handoff") &&
      finalSnapshot.includes("No real external runner dispatch") &&
      finalSnapshot.includes("No default NVIDIA `/chat` lane change"),
    finalCommandsPresent:
      finalSnapshot.includes("verify:phase160a-agent-workforce-final-closure") &&
      finalSnapshot.includes("verify:phase153a-agent-workforce-product-template-pack"),
    nextDecisionGatePresent:
      finalSnapshot.includes("Option A") &&
      finalSnapshot.includes("Option B") &&
      finalSnapshot.includes("Option C") &&
      finalSnapshot.includes("Option D") &&
      finalSnapshot.includes("Recommended default route"),
    docsSynchronized:
      texts.readme.includes("Phase 154A-160A") &&
      texts.userManual.includes("verify:phase160a-agent-workforce-final-closure") &&
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
    completedCapabilities,
    finalConclusion: "Agent Workforce Preview can be sealed as a preview product baseline.",
    recommendedDefaultRoute: "Pause real execution expansion unless the user explicitly approves a new real runner enablement mainline.",
    disabledState: createDisabledState(),
    safety: createSafety(),
    secretFindingCount,
    conclusion: passed ? "agent-workforce-final-closure-complete" : "agent-workforce-final-closure-incomplete",
  });
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  await writeEvidence(phase, {
    phase,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "agent-workforce-final-closure-incomplete",
  });
  process.exitCode = 1;
}
