import { readJson, readText, writeJson, paths, phaseResult, findBlocker } from "../phase1476_1485/phase1476-1485-common.mjs";

const upstreamPhase1476 = readJson("apps/ai-gateway-service/evidence/phase1476-concept-field-kernel/concept-field-validation-result.json", null);
const phase1477 = readJson(paths.phase1477, null);
const phase1478 = readJson(paths.phase1478, null);
const phase1479 = readJson(paths.phase1479, null);
const phase1480 = readJson(paths.phase1480, null);
const phase1481 = readJson(paths.phase1481, null);
const phase1482 = readJson(paths.phase1482, null);
const phase1483 = readJson(paths.phase1483, null);
const phase1484 = readJson(paths.phase1484, null);
const packageJson = readJson("package.json", {});
const taijiPackage = readJson("packages/taiji-beidou-engine/package.json", {});
const indexSource = readText("packages/taiji-beidou-engine/src/index.js");
const docs = [
  "docs/phase1476-concept-field-critical-audit.md",
  "docs/phase1476-concept-field-token-reduction-hypothesis.md",
  "docs/phase1477-field-snapshot-vs-token-replay-benchmark.md",
  "docs/phase1478-tianshu-route-affinity-dry-run.md",
  "docs/phase1479-god-mode-field-arbitration-dry-run.md",
  "docs/phase1480-security-risk-field-dry-run.md",
  "docs/phase1485-concept-field-experimental-seal-report.md",
];
const sourceBundle = [
  "packages/taiji-beidou-engine/src/conceptFieldKernel.js",
  "packages/taiji-beidou-engine/src/conceptFieldSyntheticSpace.js",
  "packages/taiji-beidou-engine/src/conceptFieldSnapshot.js",
  "packages/taiji-beidou-engine/src/conceptFieldBenchmark.js",
  "packages/taiji-beidou-engine/src/conceptFieldRouteAffinity.js",
  "packages/taiji-beidou-engine/src/conceptFieldEvidenceCoherence.js",
  "packages/taiji-beidou-engine/src/conceptFieldRiskScoring.js",
  "packages/taiji-beidou-engine/src/conceptFieldSleepConsolidation.js",
  "packages/taiji-beidou-engine/src/conceptFieldFailureAudit.js",
].map((path) => readText(path)).join("\n");
const evidenceBundle = JSON.stringify({ phase1477, phase1478, phase1479, phase1480, phase1481, phase1482, phase1483, phase1484 });

const checks = {
  upstreamPhase1476Sealed:
    upstreamPhase1476?.completed === true &&
    upstreamPhase1476?.recommended_sealed === true &&
    upstreamPhase1476?.blocker === null,
  phase1477Sealed: sealed(phase1477),
  phase1478Sealed: sealed(phase1478),
  phase1479Sealed: sealed(phase1479),
  phase1480Sealed: sealed(phase1480),
  phase1481Sealed: sealed(phase1481),
  phase1482Sealed: sealed(phase1482),
  phase1483Sealed: sealed(phase1483),
  phase1484Sealed: sealed(phase1484),
  conceptFieldKernelImplemented: sourceBundle.includes("runConceptFieldKernel"),
  syntheticConceptSpaceImplemented: sourceBundle.includes("createConceptFieldSyntheticSpace"),
  fieldSnapshotImplemented: sourceBundle.includes("createConceptFieldSnapshot"),
  routeAffinityImplemented: sourceBundle.includes("scoreConceptFieldRouteAffinity"),
  evidenceCoherenceImplemented: sourceBundle.includes("scoreConceptFieldEvidenceCoherence"),
  riskScoringImplemented: sourceBundle.includes("scoreConceptFieldRisk"),
  sleepConsolidationImplemented: sourceBundle.includes("planConceptFieldSleepConsolidation"),
  failureAuditImplemented: sourceBundle.includes("auditConceptFieldFailures"),
  routeAffinityScoreGenerated: phase1478?.routeAffinityScoreGenerated === true || phase1479?.routeAffinityScoreGenerated === true,
  evidenceCoherenceScoreGenerated: phase1481?.evidenceCoherenceScoreGenerated === true || phase1479?.evidenceCoherenceScoreGenerated === true,
  surpriseScoreGenerated: phase1479?.surpriseScoreGenerated === true,
  riskFieldScoreGenerated: phase1480?.riskFieldScoreGenerated === true || phase1479?.riskFieldScoreGenerated === true,
  topActivatedConceptsGenerated: evidenceBundle.includes("topActivatedConcepts"),
  topSuppressedConceptsGenerated: evidenceBundle.includes("topSuppressedConcepts"),
  unstableConceptsGenerated: evidenceBundle.includes("unstableConcepts"),
  sleepConsolidationCandidatesGenerated: evidenceBundle.includes("sleepConsolidationCandidates"),
  pruneCandidatesGenerated: evidenceBundle.includes("pruneCandidates"),
  benchmarkAgainstBaseline:
    phase1477?.benchmarkAgainstBaseline === true &&
    phase1482?.benchmarkAgainstBaseline === true &&
    phase1484?.benchmarkAgainstBaseline === true,
  randomKeywordNearestBaseline:
    phase1477?.randomBaselineGenerated === true &&
    phase1477?.keywordBaselineGenerated === true &&
    phase1477?.nearestNeighborBaselineGenerated === true,
  syntheticVectorsOnly: [phase1477, phase1478, phase1479, phase1480, phase1481, phase1482, phase1483, phase1484].every((item) => item?.syntheticVectorsOnly === true),
  noExternalDatasetOrNetwork: [phase1477, phase1478, phase1479, phase1480, phase1481, phase1482, phase1483, phase1484].every((item) =>
    item?.gloveDownloadExecuted === false &&
    item?.externalDatasetLoaded === false &&
    item?.externalNetworkUsed === false,
  ),
  noProviderCalls: [phase1477, phase1478, phase1479, phase1480, phase1481, phase1482, phase1483, phase1484].every((item) => item?.providerCallsMade === false),
  noChatMutation: [phase1477, phase1478, phase1479, phase1480, phase1481, phase1482, phase1483, phase1484].every((item) =>
    item?.chatModified === false && item?.chatGatewayExecuteModified === false,
  ),
  noDeployReleaseTagArtifact: [phase1477, phase1478, phase1479, phase1480, phase1481, phase1482, phase1483, phase1484].every((item) =>
    item?.deployExecuted === false &&
    item?.releaseExecuted === false &&
    item?.tagCreated === false &&
    item?.artifactUploaded === false,
  ),
  noForbiddenClaims: [phase1477, phase1478, phase1479, phase1480, phase1481, phase1482, phase1483, phase1484].every((item) =>
    item?.realSemanticValidationClaimed === false &&
    item?.agiClaimed === false &&
    item?.llmReplacementClaimed === false &&
    item?.trillionModelSurpassClaimed === false,
  ),
  docsPresent: docs.every((path) => readText(path).length > 40),
  packageScriptsPresent:
    packageJson?.scripts?.["smoke:phase1476-1485-concept-field-kernel"] ===
      "node tools/phase1476/run-concept-field-dry-run.mjs && node tools/phase1477/benchmark-field-snapshot-vs-token-replay.mjs && node tools/phase1478/run-tianshu-route-affinity-dry-run.mjs && node tools/phase1479/run-god-mode-field-arbitration-dry-run.mjs && node tools/phase1480/run-security-risk-field-dry-run.mjs && node tools/phase1481/run-evidence-memory-field-snapshot-integration.mjs && node tools/phase1482/run-context-gateway-token-reduction-benchmark.mjs && node tools/phase1483/run-sleep-consolidation-candidate-dry-run.mjs && node tools/phase1484/run-concept-field-failure-audit.mjs && node tools/phase1485/validate-concept-field-experimental-seal.mjs" &&
    packageJson?.scripts?.["verify:phase1476-1485-concept-field-kernel"] ===
      "node tools/phase1485/validate-concept-field-experimental-seal.mjs" &&
    packageJson?.scripts?.["verify:phase1477-field-snapshot-token-replay"] ===
      "node tools/phase1485/validate-concept-field-experimental-seal.mjs",
  taijiPackageCheckCoversNewFiles:
    [
      "conceptFieldSnapshot.js",
      "conceptFieldRouteAffinity.js",
      "conceptFieldEvidenceCoherence.js",
      "conceptFieldRiskScoring.js",
      "conceptFieldSleepConsolidation.js",
      "conceptFieldFailureAudit.js",
    ].every((file) => taijiPackage?.scripts?.check?.includes(file)),
  indexExportsPresent:
    [
      "conceptFieldSnapshot.js",
      "conceptFieldRouteAffinity.js",
      "conceptFieldEvidenceCoherence.js",
      "conceptFieldRiskScoring.js",
      "conceptFieldSleepConsolidation.js",
      "conceptFieldFailureAudit.js",
    ].every((file) => indexSource.includes(file)),
  noNetworkCode: !/(?:^|\s)(?:fetch|axios|undici|got)\s*\(|node:https|node:http|\bhttps?\./i.test(sourceBundle),
  noSecretLikeText: !containsSecretLikeValue(`${sourceBundle}\n${evidenceBundle}\n${docs.map((path) => readText(path)).join("\n")}`),
};

const blocker = findBlocker(checks);
const result = phaseResult("Phase1485", {
  phaseName: "Concept Field Kernel Experimental Seal",
  completed: blocker === null,
  recommended_sealed: blocker === null,
  blocker,
  experimentalSealCompleted: blocker === null,
  phaseStatuses: {
    Phase1476: {
      completed: checks.upstreamPhase1476Sealed,
      recommended_sealed: checks.upstreamPhase1476Sealed,
      blocker: checks.upstreamPhase1476Sealed ? null : "upstream_phase1476_not_sealed",
    },
    Phase1477: status(checks.phase1477Sealed),
    Phase1478: status(checks.phase1478Sealed),
    Phase1479: status(checks.phase1479Sealed),
    Phase1480: status(checks.phase1480Sealed),
    Phase1481: status(checks.phase1481Sealed),
    Phase1482: status(checks.phase1482Sealed),
    Phase1483: status(checks.phase1483Sealed),
    Phase1484: status(checks.phase1484Sealed),
    Phase1485: status(blocker === null),
  },
  checks,
  evidenceRefs: [paths.phase1477, paths.phase1478, paths.phase1479, paths.phase1480, paths.phase1481, paths.phase1482, paths.phase1483, paths.phase1484],
  currentSealableRange: blocker === null ? "Phase1476-1485AIO" : "none",
  currentUnsealableRange: blocker === null ? "none_in_phase1476_1485" : "Phase1476-1485AIO",
  rollback: "Remove only Phase1476-1485 concept-field files/scripts/docs/evidence added for this AIO package; keep older sealed evidence unless explicitly reverting this package.",
  nextStageSuggestion: "Proceed to Phase1486-1505AIO only after this seal remains completed=true, recommended_sealed=true, blocker=null.",
});

writeJson(paths.phase1485, result);
writeJson(paths.validation, {
  phaseRange: "Phase1476-1485AIO",
  routeChoice: "local_self_use_only",
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  checks,
  providerCallsMade: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  productionReadyClaimed: false,
  realSemanticValidationClaimed: false,
  agiClaimed: false,
  llmReplacementClaimed: false,
  trillionModelSurpassClaimed: false,
  workspaceCleanClaimed: false,
});

console.log(JSON.stringify({
  phaseRange: "Phase1476-1485AIO",
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
}, null, 2));

if (blocker) process.exitCode = 1;

function sealed(item) {
  return item?.completed === true && item?.recommended_sealed === true && item?.blocker === null;
}

function status(sealedValue) {
  return {
    completed: sealedValue,
    recommended_sealed: sealedValue,
    blocker: sealedValue ? null : "phase_not_sealed",
  };
}

function containsSecretLikeValue(text) {
  return [
    /sk-[A-Za-z0-9_-]{20,}/,
    /nvapi-[A-Za-z0-9_-]{20,}/i,
    /AKIA[0-9A-Z]{16}/,
    /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/,
  ].some((pattern) => pattern.test(text));
}
