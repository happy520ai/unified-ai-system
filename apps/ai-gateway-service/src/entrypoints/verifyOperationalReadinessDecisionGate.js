import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, readText } from "./entrypointUtils.js"

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

const jsonPath = "apps/ai-gateway-service/evidence/phase-281a-operational-readiness-decision-gate.json";
const mdPath = "apps/ai-gateway-service/evidence/phase-281a-operational-readiness-decision-gate.md";
const docsPath = "docs/OPERATIONAL_READINESS_AND_NEXT_PHASE_DECISION.md";
const uiPath = "apps/ai-gateway-service/src/ui/consolePage.js";

const requiredDocSections = [
  "Executive Summary",
  "Current Phase Status",
  "Sealed / Passed Phases",
  "Missing / Not-Sealed Phases",
  "278A not_available_or_not_sealed conclusion",
  "Evidence Chain Review",
  "Safety Boundary Summary",
  "Operational Capability Summary",
  "Non-Claimable Capability Summary",
  "Dirty Workspace Handling",
  "Commit Readiness Judgment",
  "Knowledge Enrichment Readiness Judgment",
  "UI Readiness Judgment",
  "Release / Remote / Deploy Readiness Judgment",
  "Recommended Next Routes",
  "Final Phase 281A Conclusion",
];

const requiredRoutes = [
  "Phase278A Free Model Assisted Daily Knowledge Enrichment Pipeline",
  "Commit Readiness Preflight",
  "UI Experience Polish",
  "Release / Remote / Deploy Readiness",
];

function main() {
  const evidence = readJson(jsonPath);
  const docsText = readText(docsPath);
  const mdText = readText(mdPath);
  const uiText = readText(uiPath);
  const rootPackage = readJson("package.json");
  const servicePackage = readJson("apps/ai-gateway-service/package.json");
  const phase278 = Array.isArray(evidence.reviewedPhases)
    ? evidence.reviewedPhases.find((phase) => phase.phase === "278A")
    : null;
  const combinedText = [docsText, mdText, readText(jsonPath), uiText].join("\n");

  const checks = {
    evidenceJsonExists: fileExists(jsonPath),
    evidenceMdExists: fileExists(mdPath),
    docsExists: fileExists(docsPath),
    phaseIs281A: evidence.phase === "281A",
    statusPass: evidence.status === "pass",
    currentBlockerNone: evidence.currentBlocker === "none",
    phase278MarkedNotAvailable: phase278?.status === "not_available_or_not_sealed"
      && evidence.evidenceCompleteness?.phase278aStatus === "not_available_or_not_sealed",
    paidApiCallCountZero: evidence.paidApiCallCount === 0,
    externalApiCalledFalse: evidence.externalApiCalled === false,
    mimoApiCalledFalse: evidence.mimoApiCalled === false,
    embeddingCalledFalse: evidence.embeddingCalled === false,
    legacyModifiedFalse: evidence.legacyModified === false,
    projectContextCreatedFalse: evidence.projectContextCreated === false && !fileExists("PROJECT_CONTEXT.md"),
    commitOrPushPerformedFalse: evidence.commitOrPushPerformed === false,
    workspaceCleanClaimedFalse: evidence.workspaceCleanClaimed === false,
    recommendedRoutesPresent: requiredRoutes.every((route) => evidence.recommendedNextRoutes?.includes(route)),
    docsSectionsPresent: requiredDocSections.every((section) => docsText.includes(`## ${section}`)),
    docsProductionBoundaryPresent: docsText.includes("not production-ready"),
    docs278aBoundaryPresent: docsText.includes("278A") && docsText.includes("local preview") && docsText.includes("manual approval") && docsText.includes("no provider call"),
    docsCommitPreflightBoundaryPresent: docsText.includes("commit preflight") && docsText.includes("cannot auto commit"),
    docsReleaseBoundaryPresent: docsText.includes("release readiness") && docsText.includes("cannot perform real remote or deploy"),
    packageScriptsExist: Boolean(rootPackage.scripts?.["run:phase281a-operational-readiness-decision-gate"])
      && Boolean(rootPackage.scripts?.["verify:phase281a-operational-readiness-decision-gate"])
      && Boolean(servicePackage.scripts?.["run:phase281a-operational-readiness-decision-gate"])
      && Boolean(servicePackage.scripts?.["verify:phase281a-operational-readiness-decision-gate"]),
    uiMarkerExists: uiText.includes("Operational Readiness Pack / Next-Phase Decision Gate"),
    noPlaintextApiKeyInDocsEvidenceUi: !containsPlaintextApiKey(combinedText),
  };

  const failures = Object.entries(checks)
    .filter(([, passed]) => passed !== true)
    .map(([name]) => name);

  const result = {
    phase: "281A",
    status: failures.length === 0 ? "passed" : "failed",
    checks: Object.keys(checks).length,
    failures,
    evidenceStatus: evidence.status,
    currentBlocker: evidence.currentBlocker,
    phase278aStatus: phase278?.status ?? "missing",
    operationalReadiness: evidence.operationalReadiness,
    productionReadiness: evidence.productionReadiness,
    commitReadiness: evidence.commitReadiness,
    knowledgeEnrichmentReadiness: evidence.knowledgeEnrichmentReadiness,
    uiReadiness: evidence.uiReadiness,
    releaseReadiness: evidence.releaseReadiness,
    paidApiCallCount: evidence.paidApiCallCount,
    externalApiCalled: evidence.externalApiCalled,
    mimoApiCalled: evidence.mimoApiCalled,
    embeddingCalled: evidence.embeddingCalled,
    legacyModified: evidence.legacyModified,
    projectContextCreated: evidence.projectContextCreated,
    commitOrPushPerformed: evidence.commitOrPushPerformed,
    workspaceCleanClaimed: evidence.workspaceCleanClaimed,
    evidenceJsonPath: resolve(repoRoot, jsonPath),
    evidenceMdPath: resolve(repoRoot, mdPath),
  };

  console.log(JSON.stringify(result, null, 2));
  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

function fileExists(relativePath) {
  return existsSync(resolve(repoRoot, relativePath));
}



function containsPlaintextApiKey(text) {
  return /sk-(?!test|example|placeholder|redacted|xxxx)[A-Za-z0-9_-]{20,}/i.test(text)
    || /nvapi-(?!test|example|placeholder|redacted|xxxx)[A-Za-z0-9_-]{20,}/i.test(text)
    || /Bearer\s+(?!test|example|placeholder|redacted|masked|xxxx)[A-Za-z0-9._-]{24,}/i.test(text)
    || /(Authorization|api-key)\s*[:=]\s*[A-Za-z0-9._-]{24,}/i.test(text);
}

main();
