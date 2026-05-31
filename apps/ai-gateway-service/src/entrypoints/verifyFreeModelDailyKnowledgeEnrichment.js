import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceJsonPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-278a-free-model-daily-knowledge-enrichment.json");
const evidenceMdPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-278a-free-model-daily-knowledge-enrichment.md");
const docsPath = resolve(repoRoot, "docs/FREE_MODEL_DAILY_KNOWLEDGE_ENRICHMENT_PIPELINE.md");
const policyPath = resolve(repoRoot, "apps/ai-gateway-service/src/knowledge/enrichment/freeModelDailyEnrichmentPolicy.js");
const ledgerPath = resolve(repoRoot, "apps/ai-gateway-service/src/knowledge/enrichment/enrichmentLedger.js");
const guardPath = resolve(repoRoot, "apps/ai-gateway-service/src/knowledge/enrichment/enrichmentDuplicateGuard.js");
const runPath = resolve(repoRoot, "apps/ai-gateway-service/src/entrypoints/runFreeModelDailyKnowledgeEnrichment.js");
const rootPackagePath = resolve(repoRoot, "package.json");
const servicePackagePath = resolve(repoRoot, "apps/ai-gateway-service/package.json");
const consolePagePath = resolve(repoRoot, "apps/ai-gateway-service/src/ui/consolePage.js");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function assertCheck(condition, message, failures) {
  if (!condition) {
    failures.push(message);
  }
}

function packageScriptExists(filePath, scriptName) {
  if (!existsSync(filePath)) {
    return false;
  }
  const packageJson = readJson(filePath);
  return Boolean(packageJson.scripts?.[scriptName]);
}

export function verifyFreeModelDailyKnowledgeEnrichment() {
  const failures = [];
  const requiredFiles = [
    docsPath,
    evidenceJsonPath,
    evidenceMdPath,
    policyPath,
    ledgerPath,
    guardPath,
    runPath,
  ];

  for (const filePath of requiredFiles) {
    assertCheck(existsSync(filePath), `missing required file: ${filePath}`, failures);
  }

  if (failures.length > 0) {
    return { ok: false, failures };
  }

  const evidence = readJson(evidenceJsonPath);
  const docsText = readFileSync(docsPath, "utf8");
  const consoleText = existsSync(consolePagePath) ? readFileSync(consolePagePath, "utf8") : "";

  assertCheck(evidence.phase === "278A", "phase must be 278A", failures);
  assertCheck(evidence.status === "pass", "status must be pass", failures);
  assertCheck(evidence.currentBlocker === "none", "currentBlocker must be none", failures);
  assertCheck(evidence.paidApiCallCount === 0, "paidApiCallCount must be 0", failures);
  assertCheck(evidence.externalApiCalled === false, "externalApiCalled must be false", failures);
  assertCheck(evidence.mimoApiCalled === false, "mimoApiCalled must be false", failures);
  assertCheck(evidence.embeddingCalled === false, "embeddingCalled must be false", failures);
  assertCheck(evidence.legacyModified === false, "legacyModified must be false", failures);
  assertCheck(evidence.projectContextCreated === false, "projectContextCreated must be false", failures);
  assertCheck(evidence.commitPerformed === false, "commitPerformed must be false", failures);
  assertCheck(evidence.pushPerformed === false, "pushPerformed must be false", failures);
  assertCheck(evidence.workspaceCleanClaimed === false, "workspaceCleanClaimed must be false", failures);
  assertCheck(evidence.mode === "local-preview-only", "mode must be local-preview-only", failures);
  assertCheck(evidence.schedulerMode === "manual-approval-required", "schedulerMode must be manual-approval-required", failures);
  assertCheck(evidence.manualApprovalRequired === true, "manualApprovalRequired must be true", failures);
  assertCheck(evidence.rateLimitRequestsPerMinute === 40, "rateLimitRequestsPerMinute must be 40", failures);
  assertCheck(evidence.dailyTimeBudgetHours === 2, "dailyTimeBudgetHours must be 2", failures);
  assertCheck(evidence.freeModelOnly === true, "freeModelOnly must be true", failures);
  assertCheck(evidence.privateKnowledgeDedupRequired === true, "privateKnowledgeDedupRequired must be true", failures);
  assertCheck(evidence.publicKnowledgeDedupRequired === true, "publicKnowledgeDedupRequired must be true", failures);
  assertCheck(evidence.batchDedupRequired === true, "batchDedupRequired must be true", failures);
  assertCheck(evidence.nearDuplicateGuard?.enabled === true, "nearDuplicateGuard.enabled must be true", failures);
  assertCheck(evidence.enrichmentLedger?.enabled === true, "enrichmentLedger.enabled must be true", failures);
  assertCheck(evidence.productionReadyClaimed === false, "productionReadyClaimed must be false", failures);
  assertCheck(evidence.schedulerExecuted === false, "schedulerExecuted must be false", failures);
  assertCheck(evidence.realLearningExecuted === false, "realLearningExecuted must be false", failures);
  assertCheck(evidence.duplicateGuardPreview?.privateDuplicateRejectedCount > 0, "private duplicate preview must reject at least one candidate", failures);
  assertCheck(evidence.duplicateGuardPreview?.publicDuplicateRejectedCount > 0, "public duplicate preview must reject at least one candidate", failures);
  assertCheck(evidence.duplicateGuardPreview?.batchDuplicateRejectedCount > 0, "batch duplicate preview must reject at least one candidate", failures);
  assertCheck(evidence.duplicateGuardPreview?.nearDuplicateReviewRequiredCount > 0, "near duplicate preview must require review", failures);
  assertCheck(evidence.duplicateGuardPreview?.newKnowledgeAcceptedCount > 0, "new clean knowledge must be accepted in preview", failures);

  const requiredDocsMarkers = [
    "Executive Summary",
    "Local Preview Boundary",
    "Free Model Only Policy",
    "No Paid API Boundary",
    "No MiMo Boundary",
    "No Embedding Boundary",
    "No External Provider Call Boundary",
    "Daily Learning Policy",
    "Rate Limit Policy: 40 requests/min",
    "Daily Time Budget Policy: 2 hours/day",
    "Source Trust Rules",
    "Authority / Professional Source Requirements",
    "Clean Data Requirements",
    "Private Knowledge Duplicate Guard",
    "Public Knowledge Duplicate Guard",
    "Current Batch Duplicate Guard",
    "Near Duplicate Guard",
    "Enrichment Ledger",
    "Manual Approval Scheduler",
    "Evidence and Verification",
    "Non-Production Claim Boundary",
    "Final Phase 278A Conclusion",
    "no real learning",
    "no real provider call",
    "no real scheduler",
  ];

  for (const marker of requiredDocsMarkers) {
    assertCheck(docsText.includes(marker), `docs missing marker: ${marker}`, failures);
  }

  assertCheck(packageScriptExists(rootPackagePath, "run:phase278a-free-model-daily-knowledge-enrichment"), "root run script missing", failures);
  assertCheck(packageScriptExists(rootPackagePath, "verify:phase278a-free-model-daily-knowledge-enrichment"), "root verify script missing", failures);
  assertCheck(packageScriptExists(servicePackagePath, "run:phase278a-free-model-daily-knowledge-enrichment"), "service run script missing", failures);
  assertCheck(packageScriptExists(servicePackagePath, "verify:phase278a-free-model-daily-knowledge-enrichment"), "service verify script missing", failures);
  assertCheck(consoleText.includes("Free Model Assisted Daily Knowledge Enrichment Pipeline"), "UI marker missing", failures);

  return { ok: failures.length === 0, failures };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const result = verifyFreeModelDailyKnowledgeEnrichment();
  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({
    status: "passed",
    phase: "278A",
    verifier: "verifyFreeModelDailyKnowledgeEnrichment",
  }, null, 2));
}
