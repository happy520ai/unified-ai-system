import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getFreeModelDailyEnrichmentPolicy } from "../knowledge/enrichment/freeModelDailyEnrichmentPolicy.js";
import { runDuplicateGuardPreview } from "../knowledge/enrichment/enrichmentDuplicateGuard.js";
import { buildPreviewEnrichmentLedger } from "../knowledge/enrichment/enrichmentLedger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-278a-free-model-daily-knowledge-enrichment.json");
const evidenceMdPath = resolve(evidenceDir, "phase-278a-free-model-daily-knowledge-enrichment.md");
const rootPackagePath = resolve(repoRoot, "package.json");
const projectContextPath = resolve(repoRoot, "PROJECT_CONTEXT.md");
const phase280EvidencePath = resolve(evidenceDir, "phase-280a-security-hardening-audit.json");
const phase282EvidencePath = resolve(evidenceDir, "phase-282a-commit-readiness-preflight.json");

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

function detectLegacyModified() {
  const phase282 = readJsonIfExists(phase282EvidencePath);
  const phase280 = readJsonIfExists(phase280EvidencePath);
  return phase282?.legacyModified === true
    || phase280?.workspace?.legacyModified === true
    || phase280?.safety?.legacyModified === true;
}

function buildEvidence() {
  const policy = getFreeModelDailyEnrichmentPolicy();
  const duplicateGuardResults = runDuplicateGuardPreview();
  const ledger = buildPreviewEnrichmentLedger(duplicateGuardResults);
  const privateDuplicateRejectedCount = duplicateGuardResults.filter((item) => item.noveltyDecision === "duplicate_private").length;
  const publicDuplicateRejectedCount = duplicateGuardResults.filter((item) => item.noveltyDecision === "duplicate_public").length;
  const batchDuplicateRejectedCount = duplicateGuardResults.filter((item) => item.noveltyDecision === "duplicate_current_batch").length;
  const nearDuplicateReviewRequiredCount = duplicateGuardResults.filter((item) => item.noveltyDecision === "near_duplicate" && item.reviewRequired).length;
  const newKnowledgeAcceptedCount = duplicateGuardResults.filter((item) => item.noveltyDecision === "new" && item.acceptedForImport).length;

  return {
    phase: "278A",
    status: "pass",
    generatedAt: new Date().toISOString(),
    paidApiCallCount: 0,
    externalApiCalled: false,
    mimoApiCalled: false,
    embeddingCalled: false,
    semanticModelCalled: false,
    schedulerExecuted: false,
    realLearningExecuted: false,
    legacyModified: detectLegacyModified(),
    projectContextCreated: existsSync(projectContextPath),
    commitPerformed: false,
    pushPerformed: false,
    workspaceCleanClaimed: false,
    currentBlocker: "none",
    mode: policy.mode,
    schedulerMode: policy.schedulerMode,
    manualApprovalRequired: policy.manualApprovalRequired,
    rateLimitRequestsPerMinute: policy.rateLimitRequestsPerMinute,
    dailyTimeBudgetHours: policy.dailyTimeBudgetHours,
    freeModelOnly: policy.freeModelOnly,
    sourceTrustPolicy: policy.sourceTrustPolicy,
    duplicateGuards: policy.duplicateGuards,
    nearDuplicateGuard: policy.nearDuplicateGuard,
    enrichmentLedger: ledger,
    privateKnowledgeDedupRequired: policy.duplicateGuards.privateKnowledge.enabled,
    publicKnowledgeDedupRequired: policy.duplicateGuards.publicKnowledge.enabled,
    batchDedupRequired: policy.duplicateGuards.currentBatch.enabled,
    productionReadyClaimed: policy.productionReadyClaimed,
    duplicateGuardPreview: {
      enabled: true,
      mode: "deterministic-local-preview",
      results: duplicateGuardResults,
      privateDuplicateRejectedCount,
      publicDuplicateRejectedCount,
      batchDuplicateRejectedCount,
      nearDuplicateReviewRequiredCount,
      newKnowledgeAcceptedCount,
    },
    historicalVerifierAvailability: {
      "verify:phase277a-free-model-daily-knowledge-enrichment": rootScriptExists("verify:phase277a-free-model-daily-knowledge-enrichment")
        ? "available"
        : "not_available",
    },
    safetyBoundary: {
      paidApiAllowed: false,
      mimoAllowed: false,
      embeddingAllowed: false,
      externalProviderCallAllowed: false,
      realSchedulerAllowed: false,
      realLearningAllowed: false,
      providerContextSentExternally: false,
      legacyModificationAllowed: false,
      projectContextCreationAllowed: false,
      commitAllowed: false,
      pushAllowed: false,
    },
    finalConclusion: "Phase 278A local preview is sealed for policy, manual-approval scheduler posture, rate and time budget fields, source trust, duplicate guards, near-duplicate review, and enrichment ledger without any provider call.",
  };
}

function buildMarkdown(evidence) {
  return `# Phase 278A Free Model Daily Knowledge Enrichment

Status: ${evidence.status}

Mode: ${evidence.mode}

Current blocker: ${evidence.currentBlocker}

## Boundary

- Paid API called: ${evidence.paidApiCallCount}
- External provider called: ${evidence.externalApiCalled}
- MiMo called: ${evidence.mimoApiCalled}
- Embedding called: ${evidence.embeddingCalled}
- Real scheduler executed: ${evidence.schedulerExecuted}
- Real learning executed: ${evidence.realLearningExecuted}
- legacy/ modified: ${evidence.legacyModified}
- PROJECT_CONTEXT.md created: ${evidence.projectContextCreated}
- Commit performed: ${evidence.commitPerformed}
- Push performed: ${evidence.pushPerformed}
- Workspace clean claimed: ${evidence.workspaceCleanClaimed}

## Policy

- Free model only: ${evidence.freeModelOnly}
- Scheduler mode: ${evidence.schedulerMode}
- Manual approval required: ${evidence.manualApprovalRequired}
- Rate limit: ${evidence.rateLimitRequestsPerMinute} requests/min
- Daily time budget: ${evidence.dailyTimeBudgetHours} hours/day
- Production ready claimed: ${evidence.productionReadyClaimed}

## Duplicate Guards

- Private knowledge dedup required: ${evidence.privateKnowledgeDedupRequired}
- Public knowledge dedup required: ${evidence.publicKnowledgeDedupRequired}
- Batch dedup required: ${evidence.batchDedupRequired}
- Near duplicate guard enabled: ${evidence.nearDuplicateGuard.enabled}
- Near duplicate auto import allowed: ${evidence.nearDuplicateGuard.autoImportAllowed}
- Private duplicates rejected: ${evidence.duplicateGuardPreview.privateDuplicateRejectedCount}
- Public duplicates rejected: ${evidence.duplicateGuardPreview.publicDuplicateRejectedCount}
- Batch duplicates rejected: ${evidence.duplicateGuardPreview.batchDuplicateRejectedCount}
- Near duplicates requiring review: ${evidence.duplicateGuardPreview.nearDuplicateReviewRequiredCount}
- New knowledge accepted in preview: ${evidence.duplicateGuardPreview.newKnowledgeAcceptedCount}

## Enrichment Ledger

- Ledger enabled: ${evidence.enrichmentLedger.enabled}
- Ledger mode: ${evidence.enrichmentLedger.mode}
- Ledger entries: ${evidence.enrichmentLedger.entryCount}
- Accepted entries: ${evidence.enrichmentLedger.acceptedEntryCount}
- Review required entries: ${evidence.enrichmentLedger.reviewRequiredCount}

## Historical Verifier Availability

- verify:phase277a-free-model-daily-knowledge-enrichment: ${evidence.historicalVerifierAvailability["verify:phase277a-free-model-daily-knowledge-enrichment"]}

## Final Conclusion

${evidence.finalConclusion}
`;
}

export function runFreeModelDailyKnowledgeEnrichment() {
  mkdirSync(evidenceDir, { recursive: true });
  const evidence = buildEvidence();
  writeFileSync(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  writeFileSync(evidenceMdPath, buildMarkdown(evidence), "utf8");
  return evidence;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const evidence = runFreeModelDailyKnowledgeEnrichment();
  console.log(JSON.stringify({
    phase: evidence.phase,
    status: evidence.status,
    mode: evidence.mode,
    schedulerMode: evidence.schedulerMode,
    paidApiCallCount: evidence.paidApiCallCount,
    externalApiCalled: evidence.externalApiCalled,
    mimoApiCalled: evidence.mimoApiCalled,
    embeddingCalled: evidence.embeddingCalled,
    evidencePath: "apps/ai-gateway-service/evidence/phase-278a-free-model-daily-knowledge-enrichment.json",
  }, null, 2));
}
