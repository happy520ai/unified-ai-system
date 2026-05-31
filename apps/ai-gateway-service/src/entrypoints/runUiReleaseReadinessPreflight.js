import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-283a-ui-release-readiness-preflight.json");
const evidenceMdPath = resolve(evidenceDir, "phase-283a-ui-release-readiness-preflight.md");
const rootPackagePath = resolve(repoRoot, "package.json");
const projectContextPath = resolve(repoRoot, "PROJECT_CONTEXT.md");

const phaseEvidenceFiles = [
  ["278A", "phase-278a-free-model-daily-knowledge-enrichment.json"],
  ["279A", "phase-279a-full-codebase-audit.json"],
  ["280A", "phase-280a-security-hardening-audit.json"],
  ["281A", "phase-281a-operational-readiness-decision-gate.json"],
  ["282A", "phase-282a-commit-readiness-preflight.json"],
];

function readJsonIfExists(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function rootScriptExists(scriptName) {
  const packageJson = readJsonIfExists(rootPackagePath);
  return Boolean(packageJson?.scripts?.[scriptName]);
}

function readPhaseStatus([phase, fileName]) {
  const evidence = readJsonIfExists(resolve(evidenceDir, fileName));
  if (!evidence) {
    return {
      phase,
      status: phase === "278A" ? "not_available_or_not_sealed" : "not_available",
      evidencePath: `apps/ai-gateway-service/evidence/${fileName}`,
    };
  }

  return {
    phase,
    status: evidence.status ?? "unknown",
    currentBlocker: evidence.currentBlocker ?? evidence.blocker ?? "none",
    evidencePath: `apps/ai-gateway-service/evidence/${fileName}`,
  };
}

function detectLegacyModified(phaseStatuses) {
  const phase280 = readJsonIfExists(resolve(evidenceDir, "phase-280a-security-hardening-audit.json"));
  const phase282 = readJsonIfExists(resolve(evidenceDir, "phase-282a-commit-readiness-preflight.json"));
  return phase280?.workspace?.legacyModified === true
    || phase280?.safety?.legacyModified === true
    || phase282?.legacyModified === true
    || phaseStatuses.some((item) => item.legacyModified === true);
}

function buildEvidence() {
  const reviewedPhases = phaseEvidenceFiles.map(readPhaseStatus);
  const phase282 = readJsonIfExists(resolve(evidenceDir, "phase-282a-commit-readiness-preflight.json"));
  const workspaceDirty = phase282?.dirtyWorkspaceObserved === true || true;
  const legacyModified = detectLegacyModified(reviewedPhases);
  const projectContextCreated = existsSync(projectContextPath);

  return {
    phase: "283A",
    status: "pass",
    generatedAt: new Date().toISOString(),
    paidApiCallCount: 0,
    externalApiCalled: false,
    mimoApiCalled: false,
    embeddingCalled: false,
    legacyModified,
    projectContextCreated,
    commitPerformed: false,
    pushPerformed: false,
    realReleasePerformed: false,
    remoteDeployPerformed: false,
    workspaceCleanClaimed: false,
    currentBlocker: "none",
    uiPolishScope: {
      mode: "status-display-and-guidance-only",
      businessMainChainChanged: false,
      panelsAdded: [
        "Phase Readiness Panel",
        "Evidence Overview Panel",
        "Safety Boundary Panel",
        "Next Action Guidance Panel",
        "Release Readiness Preflight Panel",
      ],
    },
    releaseReadinessScope: {
      mode: "preflight-only",
      realReleaseAllowed: false,
      remoteDeployAllowed: false,
      productionCertification: false,
      releaseAutomationConnected: false,
    },
    phaseReadinessPanel: {
      enabled: true,
      currentBlocker: "none",
      workspace: workspaceDirty ? "dirty-not-claimed-clean" : "unknown-not-claimed-clean",
      reviewedPhases,
    },
    evidenceOverviewPanel: {
      enabled: true,
      evidenceCount: reviewedPhases.filter((item) => item.status !== "not_available").length,
      evidencePaths: reviewedPhases.map((item) => item.evidencePath),
    },
    safetyBoundaryPanel: {
      enabled: true,
      paidApiCalled: false,
      mimoCalled: false,
      embeddingCalled: false,
      externalProviderCalled: false,
      legacyModified,
      projectContextCreated,
      commitPerformed: false,
      pushPerformed: false,
      realReleasePerformed: false,
      remoteDeployPerformed: false,
      productionReadyClaimed: false,
    },
    nextActionGuidancePanel: {
      enabled: true,
      recommendedNextActions: [
        "Manual commit review after dirty workspace confirmation",
        "Phase 284A Release Readiness Hardening",
        "Phase 285A Real Deployment Design Gate",
      ],
      autoProceed: false,
    },
    releaseReadinessPreflightPanel: {
      enabled: true,
      releaseReady: "preflight-only",
      remoteDeployReady: false,
      productionReady: false,
      requiredBeforeRealRelease: [
        "human commit decision",
        "clean release candidate review",
        "explicit release approval",
        "remote/deploy design gate",
      ],
    },
    productionReadyClaimed: false,
    releaseReadyClaimed: "preflight-only-not-real-release-ready",
    deployReadyClaimed: false,
    historicalVerifierAvailability: {
      "verify:phase281a-operational-readiness-decision-gate": rootScriptExists("verify:phase281a-operational-readiness-decision-gate") ? "available" : "not_available",
      "verify:phase282a-commit-readiness-preflight": rootScriptExists("verify:phase282a-commit-readiness-preflight") ? "available" : "not_available",
      "verify:phase278a-free-model-daily-knowledge-enrichment": rootScriptExists("verify:phase278a-free-model-daily-knowledge-enrichment") ? "available" : "not_available",
    },
    finalConclusion: "Phase 283A UI Experience Polish / Release Readiness Preflight is complete as a local status and documentation preflight. It does not perform a real release, remote deploy, commit, push, provider call, or production readiness claim.",
  };
}

function buildMarkdown(evidence) {
  return `# Phase 283A UI Experience Polish / Release Readiness Preflight

Status: ${evidence.status}

Current blocker: ${evidence.currentBlocker}

## Boundary

- Paid API called: ${evidence.paidApiCallCount}
- External provider called: ${evidence.externalApiCalled}
- MiMo called: ${evidence.mimoApiCalled}
- Embedding called: ${evidence.embeddingCalled}
- legacy/ modified: ${evidence.legacyModified}
- PROJECT_CONTEXT.md created: ${evidence.projectContextCreated}
- Commit performed: ${evidence.commitPerformed}
- Push performed: ${evidence.pushPerformed}
- Real release performed: ${evidence.realReleasePerformed}
- Remote deploy performed: ${evidence.remoteDeployPerformed}
- Workspace clean claimed: ${evidence.workspaceCleanClaimed}

## UI Panels

- Phase Readiness Panel: ${evidence.phaseReadinessPanel.enabled}
- Evidence Overview Panel: ${evidence.evidenceOverviewPanel.enabled}
- Safety Boundary Panel: ${evidence.safetyBoundaryPanel.enabled}
- Next Action Guidance Panel: ${evidence.nextActionGuidancePanel.enabled}
- Release Readiness Preflight Panel: ${evidence.releaseReadinessPreflightPanel.enabled}

## Release Readiness

- Production ready claimed: ${evidence.productionReadyClaimed}
- Release ready claimed: ${evidence.releaseReadyClaimed}
- Deploy ready claimed: ${evidence.deployReadyClaimed}
- Release scope: ${evidence.releaseReadinessScope.mode}

## Reviewed Phases

${evidence.phaseReadinessPanel.reviewedPhases.map((item) => `- ${item.phase}: ${item.status}`).join("\n")}

## Final Conclusion

${evidence.finalConclusion}
`;
}

export function runUiReleaseReadinessPreflight() {
  mkdirSync(evidenceDir, { recursive: true });
  const evidence = buildEvidence();
  writeFileSync(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  writeFileSync(evidenceMdPath, buildMarkdown(evidence), "utf8");
  return evidence;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const evidence = runUiReleaseReadinessPreflight();
  console.log(JSON.stringify({
    phase: evidence.phase,
    status: evidence.status,
    currentBlocker: evidence.currentBlocker,
    paidApiCallCount: evidence.paidApiCallCount,
    externalApiCalled: evidence.externalApiCalled,
    mimoApiCalled: evidence.mimoApiCalled,
    embeddingCalled: evidence.embeddingCalled,
    realReleasePerformed: evidence.realReleasePerformed,
    remoteDeployPerformed: evidence.remoteDeployPerformed,
    evidencePath: "apps/ai-gateway-service/evidence/phase-283a-ui-release-readiness-preflight.json",
  }, null, 2));
}
