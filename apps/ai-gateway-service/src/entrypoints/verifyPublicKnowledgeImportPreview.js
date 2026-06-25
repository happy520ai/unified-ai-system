import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, readText } from "./entrypointUtils.js"

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const jsonPath = "apps/ai-gateway-service/evidence/phase-277a-public-knowledge-import-preview.json";
const mdPath = "apps/ai-gateway-service/evidence/phase-277a-public-knowledge-import-preview.md";

const requiredFiles = [
  "apps/ai-gateway-service/src/knowledge-import/publicKnowledgeManifest.js",
  "apps/ai-gateway-service/src/knowledge-import/publicKnowledgeImportPolicy.js",
  "apps/ai-gateway-service/src/knowledge-import/publicKnowledgeImportTypes.js",
  "apps/ai-gateway-service/src/knowledge-import/publicKnowledgeCleaner.js",
  "apps/ai-gateway-service/src/knowledge-import/publicKnowledgeChunker.js",
  "apps/ai-gateway-service/src/knowledge-import/publicKnowledgeSourceTrust.js",
  "apps/ai-gateway-service/src/knowledge-import/publicKnowledgeIndexPreview.js",
  "apps/ai-gateway-service/src/knowledge-import/publicKnowledgeNoveltyGuard.js",
  "apps/ai-gateway-service/src/knowledge-import/publicKnowledgeDedupIndex.js",
  "apps/ai-gateway-service/src/knowledge-import/publicKnowledgeImportBenchmark.js",
  "apps/ai-gateway-service/src/knowledge-import/adapters/kiwixZimAdapterPreview.js",
  "apps/ai-gateway-service/src/knowledge-import/adapters/gutenbergTextAdapterPreview.js",
  "apps/ai-gateway-service/src/knowledge-import/adapters/wikidataJsonAdapterPreview.js",
  "apps/ai-gateway-service/src/entrypoints/runPublicKnowledgeImportPreview.js",
  "apps/ai-gateway-service/src/entrypoints/verifyPublicKnowledgeImportPreview.js",
  "docs/PUBLIC_KNOWLEDGE_LIBRARY_IMPORT_PREVIEW.md",
  "apps/ai-gateway-service/fixtures/public-knowledge/README.md",
  "apps/ai-gateway-service/fixtures/public-knowledge/gutenberg-sample.txt",
  "apps/ai-gateway-service/fixtures/public-knowledge/wikipedia-sample.html",
  "apps/ai-gateway-service/fixtures/public-knowledge/wikidata-sample.json",
  "apps/ai-gateway-service/fixtures/public-knowledge/private-duplicate-sample.txt",
  "apps/ai-gateway-service/fixtures/public-knowledge/public-duplicate-sample.txt",
  "apps/ai-gateway-service/fixtures/public-knowledge/current-batch-duplicate-sample.txt",
  "apps/ai-gateway-service/fixtures/public-knowledge/near-duplicate-sample.txt",
  "apps/ai-gateway-service/fixtures/public-knowledge/secret-like-sample.txt",
  "apps/ai-gateway-service/fixtures/public-knowledge/low-trust-sample.txt",
  jsonPath,
  mdPath,
];

const requiredDocSections = [
  "Purpose",
  "Current status",
  "Why public knowledge import matters",
  "What counts as public knowledge",
  "Recommended public sources",
  "Kiwix / Wikipedia preview",
  "Project Gutenberg preview",
  "Wikidata preview",
  "What this phase imports",
  "What this phase does not import",
  "Import pipeline",
  "Cleaning",
  "Chunking",
  "Index preview",
  "Source trust score",
  "Freshness policy",
  "License and attribution notes",
  "Public knowledge vs project evidence priority",
  "Multi-layer novelty guard",
  "Private knowledge dedup",
  "Public knowledge dedup",
  "Current batch dedup",
  "Near-duplicate review policy",
  "Why public knowledge already present should not be imported again",
  "Only new authoritative clean knowledge can be imported",
  "RAG source selection integration",
  "Token saving impact",
  "Safety boundaries",
  "Verification commands",
  "Next phase options",
];

function main() {
  const evidence = readJson(jsonPath);
  const docsText = readText("docs/PUBLIC_KNOWLEDGE_LIBRARY_IMPORT_PREVIEW.md");
  const uiText = readText("apps/ai-gateway-service/src/ui/consolePage.js");
  const rootPackage = readJson("package.json");
  const servicePackage = readJson("apps/ai-gateway-service/package.json");
  const fixtureFiles = [
    "README.md",
    "gutenberg-sample.txt",
    "wikipedia-sample.html",
    "wikidata-sample.json",
    "private-duplicate-sample.txt",
    "public-duplicate-sample.txt",
    "current-batch-duplicate-sample.txt",
    "near-duplicate-sample.txt",
    "secret-like-sample.txt",
    "low-trust-sample.txt",
  ];
  const combinedText = [
    docsText,
    readText(jsonPath),
    readText(mdPath),
    uiText,
    ...fixtureFiles.map((fileName) => readText(`apps/ai-gateway-service/fixtures/public-knowledge/${fileName}`)),
  ].join("\n");

  const cases = Array.isArray(evidence.cases) ? evidence.cases : [];
  const summary = evidence.summary ?? {};
  const safety = evidence.safety ?? {};
  const policy = evidence.policy ?? {};
  const priorityRules = evidence.publicKnowledgePriorityRules ?? {};
  const noveltyGuard = evidence.noveltyGuard ?? {};

  const checks = {
    publicKnowledgeManifestExists: fileExists("apps/ai-gateway-service/src/knowledge-import/publicKnowledgeManifest.js"),
    publicKnowledgeImportPolicyExists: fileExists("apps/ai-gateway-service/src/knowledge-import/publicKnowledgeImportPolicy.js"),
    publicKnowledgeCleanerExists: fileExists("apps/ai-gateway-service/src/knowledge-import/publicKnowledgeCleaner.js"),
    publicKnowledgeChunkerExists: fileExists("apps/ai-gateway-service/src/knowledge-import/publicKnowledgeChunker.js"),
    publicKnowledgeSourceTrustExists: fileExists("apps/ai-gateway-service/src/knowledge-import/publicKnowledgeSourceTrust.js"),
    publicKnowledgeIndexPreviewExists: fileExists("apps/ai-gateway-service/src/knowledge-import/publicKnowledgeIndexPreview.js"),
    publicKnowledgeNoveltyGuardExists: fileExists("apps/ai-gateway-service/src/knowledge-import/publicKnowledgeNoveltyGuard.js"),
    publicKnowledgeDedupIndexExists: fileExists("apps/ai-gateway-service/src/knowledge-import/publicKnowledgeDedupIndex.js"),
    publicKnowledgeImportBenchmarkExists: fileExists("apps/ai-gateway-service/src/knowledge-import/publicKnowledgeImportBenchmark.js"),
    kiwixAdapterExists: fileExists("apps/ai-gateway-service/src/knowledge-import/adapters/kiwixZimAdapterPreview.js"),
    gutenbergAdapterExists: fileExists("apps/ai-gateway-service/src/knowledge-import/adapters/gutenbergTextAdapterPreview.js"),
    wikidataAdapterExists: fileExists("apps/ai-gateway-service/src/knowledge-import/adapters/wikidataJsonAdapterPreview.js"),
    runEntrypointExists: fileExists("apps/ai-gateway-service/src/entrypoints/runPublicKnowledgeImportPreview.js"),
    docsExists: fileExists("docs/PUBLIC_KNOWLEDGE_LIBRARY_IMPORT_PREVIEW.md"),
    evidenceJsonExists: fileExists(jsonPath),
    evidenceMdExists: fileExists(mdPath),
    requiredFilesExist: requiredFiles.every(fileExists),
    packageScriptsExist: Boolean(rootPackage.scripts?.["import:public-knowledge:preview"])
      && Boolean(rootPackage.scripts?.["verify:phase277a-public-knowledge-import-preview"])
      && Boolean(servicePackage.scripts?.["import:public-knowledge:preview"])
      && Boolean(servicePackage.scripts?.["verify:phase277a-public-knowledge-import-preview"]),
    uiMarkerExists: uiText.includes("Public Knowledge Library Import Preview")
      && uiText.includes("privateDuplicateRejectedCount")
      && uiText.includes("onlyNewKnowledgeCanBeImported"),
    requiredDocsSectionsPresent: requiredDocSections.every((section) => docsText.includes(`## ${section}`)),
    evidenceStatusPassed: evidence.status === "passed",
    caseCountAtLeast12: summary.caseCount >= 12 && cases.length >= 12,
    sourceFamilyCountAtLeast3: evidence.manifest?.sourceFamilyCount >= 3,
    documentsImportedPositive: summary.documentsImported > 0,
    chunksCreatedPositive: summary.chunksCreated > 0,
    entitiesParsedPositive: summary.entitiesParsed > 0,
    keywordIndexBuiltTrue: summary.keywordIndexBuilt === true,
    embeddingIndexBuiltFalse: summary.embeddingIndexBuilt === false,
    vectorIndexBuiltFalse: summary.vectorIndexBuilt === false,
    autoDownloadDisabled: evidence.autoDownloadEnabled === false,
    fullDatasetImportDisabled: evidence.fullDatasetImportEnabled === false,
    paidApiCallCountZero: evidence.paidApiCallCount === 0,
    externalApiCalledFalse: evidence.externalApiCalled === false,
    mimoApiCalledFalse: evidence.mimoApiCalled === false,
    embeddingApiCalledFalse: evidence.embeddingApiCalled === false,
    llmCleaningCalledFalse: evidence.llmCleaningCalled === false,
    largeDatasetDownloadedFalse: safety.largeDatasetDownloaded === false,
    fullDatasetImportedFalse: safety.fullDatasetImported === false,
    projectEvidenceOverridesPublicKnowledge: priorityRules.projectEvidenceOverridesPublicKnowledge === true,
    requireMultiLayerNoveltyCheckTrue: policy.requireMultiLayerNoveltyCheck === true,
    checkPrivateKnowledgeIndexTrue: policy.checkPrivateKnowledgeIndex === true && noveltyGuard.checkPrivateKnowledgeIndex === true,
    checkPublicKnowledgeIndexTrue: policy.checkPublicKnowledgeIndex === true && noveltyGuard.checkPublicKnowledgeIndex === true,
    checkCurrentBatchIndexTrue: policy.checkCurrentBatchIndex === true && noveltyGuard.checkCurrentBatchIndex === true,
    privateDuplicateRejected: summary.privateDuplicateRejectedCount > 0,
    publicDuplicateRejected: summary.publicDuplicateRejectedCount > 0,
    batchDuplicateRejected: summary.batchDuplicateRejectedCount > 0,
    nearDuplicateReviewRequired: summary.nearDuplicateReviewRequiredCount > 0,
    newKnowledgeAccepted: summary.newKnowledgeAcceptedCount > 0,
    privateDuplicateKnowledgeImportedFalse: safety.privateDuplicateKnowledgeImported === false,
    publicDuplicateKnowledgeImportedFalse: safety.publicDuplicateKnowledgeImported === false,
    batchDuplicateKnowledgeImportedFalse: safety.batchDuplicateKnowledgeImported === false,
    nearDuplicateAutoImportedFalse: safety.nearDuplicateAutoImported === false,
    onlyNewKnowledgeCanBeImportedTrue: priorityRules.onlyNewKnowledgeCanBeImported === true
      && noveltyGuard.onlyNewKnowledgeCanBeImported === true,
    onlyNewAcceptedForImport: cases.every((item) => item.acceptedForImport !== true || item.noveltyDecision === "new"),
    duplicatePrivateNotAccepted: cases.every((item) => item.noveltyDecision !== "duplicate_private" || item.acceptedForImport === false),
    duplicatePublicNotAccepted: cases.every((item) => item.noveltyDecision !== "duplicate_public" || item.acceptedForImport === false),
    duplicateCurrentBatchNotAccepted: cases.every((item) => item.noveltyDecision !== "duplicate_current_batch" || item.acceptedForImport === false),
    nearDuplicateNotAccepted: cases.every((item) => item.noveltyDecision !== "near_duplicate" || item.acceptedForImport === false),
    noPlaintextApiKeyInDocsEvidenceUiFixtures: !containsPlaintextApiKey(combinedText),
    noProductionReadyClaim: !hasPositiveProductionReadyClaim(docsText) && !hasPositiveProductionReadyClaim(readText(mdPath)),
    legacyModifiedFalse: safety.legacyModified === false,
    projectContextCreatedFalse: safety.projectContextCreated === false && !fileExists("PROJECT_CONTEXT.md"),
  };

  const failures = Object.entries(checks).filter(([, value]) => value !== true).map(([key]) => key);
  const result = {
    phase: "277A-public-knowledge-import-preview",
    status: failures.length === 0 ? "passed" : "failed",
    checks: Object.keys(checks).length,
    failures,
    caseCount: summary.caseCount ?? 0,
    sourceFamilyCount: evidence.manifest?.sourceFamilyCount ?? 0,
    documentsImported: summary.documentsImported ?? 0,
    chunksCreated: summary.chunksCreated ?? 0,
    entitiesParsed: summary.entitiesParsed ?? 0,
    privateDuplicateRejectedCount: summary.privateDuplicateRejectedCount ?? 0,
    publicDuplicateRejectedCount: summary.publicDuplicateRejectedCount ?? 0,
    batchDuplicateRejectedCount: summary.batchDuplicateRejectedCount ?? 0,
    nearDuplicateReviewRequiredCount: summary.nearDuplicateReviewRequiredCount ?? 0,
    newKnowledgeAcceptedCount: summary.newKnowledgeAcceptedCount ?? 0,
    paidApiCallCount: evidence.paidApiCallCount,
    externalApiCalled: evidence.externalApiCalled,
    mimoApiCalled: evidence.mimoApiCalled,
    embeddingApiCalled: evidence.embeddingApiCalled,
    llmCleaningCalled: evidence.llmCleaningCalled,
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
  return /sk-[A-Za-z0-9]{16,}/i.test(text)
    || /nvapi-[A-Za-z0-9]{16,}/i.test(text)
    || /Bearer\s+[A-Za-z0-9._-]{16,}/i.test(text)
    || /(Authorization|api-key)\s*[:=]\s*[A-Za-z0-9._-]{16,}/i.test(text);
}

function hasPositiveProductionReadyClaim(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.toLowerCase())
    .some((line) => {
      const mentionsReady = line.includes("production-ready")
        || line.includes("production ready")
        || line.includes("production public knowledge")
        || line.includes("production-grade");
      if (!mentionsReady) return false;
      return !["not", "does not", "cannot", "no ", "is not", "isn't"].some((guardWord) => line.includes(guardWord));
    });
}

main();
