import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRagSourceSelectionBridge } from "./publicKnowledgeIndexPreview.js";
import { createEmptyCase, PUBLIC_KNOWLEDGE_FIXTURE_DIR } from "./publicKnowledgeImportTypes.js";
import { compareProjectEvidenceWithPublicKnowledge } from "./publicKnowledgeSourceTrust.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

export function createBenchmarkCases({ manifest, importResult, noveltyPreview }) {
  const cases = [];
  const families = new Set(manifest.sources.map((source) => source.family));
  const manifestCase = createEmptyCase("manifest-completeness", "manifest");
  manifestCase.status = families.has("kiwix-zim") && families.has("project-gutenberg") && families.has("wikidata-json") ? "pass" : "fail";
  manifestCase.warnings = manifestCase.status === "pass" ? [] : ["missing_required_public_source_family"];
  cases.push(manifestCase);

  const gutenbergCase = createEmptyCase("gutenberg-sample-import", "project-gutenberg");
  gutenbergCase.documentsImported = importResult.gutenberg.documentsImported;
  gutenbergCase.chunksCreated = importResult.chunks.filter((chunk) => chunk.sourceId === "project-gutenberg-preview").length;
  applyNovelty(gutenbergCase, findChunkDecision(noveltyPreview, "project-gutenberg-preview"));
  gutenbergCase.status = gutenbergCase.documentsImported > 0 && gutenbergCase.chunksCreated > 0 ? "pass" : "fail";
  cases.push(gutenbergCase);

  const wikipediaCase = createEmptyCase("wikipedia-kiwix-sample-import", "kiwix-zim");
  wikipediaCase.documentsImported = importResult.wikipedia.sampleArticlesExtracted;
  wikipediaCase.chunksCreated = importResult.chunks.filter((chunk) => chunk.sourceId === "kiwix-wikipedia-preview").length;
  applyNovelty(wikipediaCase, findChunkDecision(noveltyPreview, "kiwix-wikipedia-preview"));
  wikipediaCase.status = importResult.wikipedia.zimParserAvailable === false && wikipediaCase.chunksCreated > 0 ? "pass" : "fail";
  cases.push(wikipediaCase);

  const wikidataCase = createEmptyCase("wikidata-sample-import", "wikidata-json");
  wikidataCase.entitiesParsed = importResult.wikidata.entitiesParsed;
  wikidataCase.status = importResult.wikidata.entityRecord.claimCount > 0 && wikidataCase.entitiesParsed > 0 ? "pass" : "fail";
  cases.push(wikidataCase);

  const trustCase = createEmptyCase("source-trust-score", "trust-score");
  const trust = compareProjectEvidenceWithPublicKnowledge("kiwix-zim");
  trustCase.status = trust.projectEvidenceOverridesPublicKnowledge
    && noveltyPreview.lowTrust.lowTrustRejectedByDefault === true
    ? "pass"
    : "fail";
  trustCase.projectEvidenceTrustScore = trust.projectEvidenceTrustScore;
  trustCase.publicSourceTrustScore = trust.publicSourceTrustScore;
  trustCase.lowTrustKnowledgeImported = false;
  cases.push(trustCase);

  const secretCase = createEmptyCase("secret-like-content-rejection", "fixture-secret-test");
  secretCase.secretRejected = importResult.secretCleaner.rejected === true || importResult.secretCleaner.sanitized === true;
  secretCase.status = secretCase.secretRejected ? "pass" : "fail";
  cases.push(secretCase);

  const ragCase = createEmptyCase("rag-source-selection-bridge", "kiwix-zim");
  ragCase.chunksCreated = importResult.ragBridge.selectedSources.length;
  ragCase.selectedContextPackGenerated = Array.isArray(importResult.ragBridge.selectedContextPack) && importResult.ragBridge.selectedContextPack.length > 0;
  ragCase.status = ragCase.selectedContextPackGenerated && importResult.ragBridge.modelCalled === false ? "pass" : "fail";
  cases.push(ragCase);

  const projectStatusCase = createEmptyCase("project-status-priority", "project-evidence-priority");
  const projectBridge = createRagSourceSelectionBridge({
    query: "What is the current project status?",
    chunks: importResult.chunks.slice(0, 1),
    projectEvidenceSources: [
      { path: "apps/ai-gateway-service/evidence/phase-274a-system-capability-benchmark.json", rank: "project-authoritative" },
      { path: "apps/ai-gateway-service/evidence/phase-276a-quality-cost-answer-router-preview.json", rank: "project-authoritative" },
    ],
  });
  projectStatusCase.projectEvidenceOverridesPublicKnowledge = projectBridge.projectEvidenceOverridesPublicKnowledge;
  projectStatusCase.status = projectBridge.publicKnowledgeAllowedForCurrentProjectState === false ? "pass" : "fail";
  cases.push(projectStatusCase);

  const privateDuplicateCase = createEmptyCase("private-knowledge-duplicate-rejected", "private-dedup");
  applyNovelty(privateDuplicateCase, noveltyPreview.privateDuplicate);
  privateDuplicateCase.status = privateDuplicateCase.noveltyDecision === "duplicate_private"
    && privateDuplicateCase.existsInPrivateKnowledge
    && privateDuplicateCase.acceptedForImport === false
    ? "pass"
    : "fail";
  cases.push(privateDuplicateCase);

  const publicDuplicateCase = createEmptyCase("public-knowledge-duplicate-rejected", "public-dedup");
  applyNovelty(publicDuplicateCase, noveltyPreview.publicDuplicate);
  publicDuplicateCase.status = publicDuplicateCase.noveltyDecision === "duplicate_public"
    && publicDuplicateCase.existsInPublicKnowledge
    && publicDuplicateCase.acceptedForImport === false
    ? "pass"
    : "fail";
  cases.push(publicDuplicateCase);

  const batchDuplicateCase = createEmptyCase("current-batch-duplicate-rejected", "current-batch-dedup");
  applyNovelty(batchDuplicateCase, noveltyPreview.batchDuplicate);
  batchDuplicateCase.status = batchDuplicateCase.noveltyDecision === "duplicate_current_batch"
    && batchDuplicateCase.existsInCurrentBatch
    && batchDuplicateCase.acceptedForImport === false
    ? "pass"
    : "fail";
  cases.push(batchDuplicateCase);

  const nearDuplicateCase = createEmptyCase("near-duplicate-review-required", "near-duplicate-review");
  applyNovelty(nearDuplicateCase, noveltyPreview.nearDuplicate);
  nearDuplicateCase.status = nearDuplicateCase.noveltyDecision === "near_duplicate"
    && nearDuplicateCase.reviewRequired === true
    && nearDuplicateCase.acceptedForImport === false
    ? "pass"
    : "fail";
  cases.push(nearDuplicateCase);

  return cases;
}

export function summarizeCases(cases, importResult) {
  return {
    caseCount: cases.length,
    documentsImported: importResult.documents.length,
    chunksCreated: importResult.chunks.length,
    entitiesParsed: importResult.wikidata.entitiesParsed,
    keywordIndexBuilt: importResult.indexPreview.keywordIndexBuilt,
    embeddingIndexBuilt: false,
    vectorIndexBuilt: false,
    secretRejectedCount: cases.filter((item) => item.secretRejected).length,
    privateDuplicateRejectedCount: cases.filter((item) => item.noveltyDecision === "duplicate_private" && item.acceptedForImport === false).length,
    publicDuplicateRejectedCount: cases.filter((item) => item.noveltyDecision === "duplicate_public" && item.acceptedForImport === false).length,
    batchDuplicateRejectedCount: cases.filter((item) => item.noveltyDecision === "duplicate_current_batch" && item.acceptedForImport === false).length,
    nearDuplicateReviewRequiredCount: cases.filter((item) => item.noveltyDecision === "near_duplicate" && item.reviewRequired === true && item.acceptedForImport === false).length,
    newKnowledgeAcceptedCount: cases.filter((item) => item.noveltyDecision === "new" && item.acceptedForImport === true).length,
    passCount: cases.filter((item) => item.status === "pass").length,
    warnCount: cases.filter((item) => item.status === "warn").length,
    failCount: cases.filter((item) => item.status === "fail").length,
  };
}

function applyNovelty(target, decision) {
  if (!decision) return target;
  Object.assign(target, {
    noveltyDecision: decision.noveltyDecision,
    acceptedForImport: decision.acceptedForImport,
    existsInPrivateKnowledge: decision.existsInPrivateKnowledge,
    existsInPublicKnowledge: decision.existsInPublicKnowledge,
    existsInCurrentBatch: decision.existsInCurrentBatch,
    reviewRequired: decision.reviewRequired,
    nearDuplicateScore: decision.nearDuplicateScore,
  });
  return target;
}

function findChunkDecision(noveltyPreview, sourceId) {
  return noveltyPreview.decisions.find((item) => item.chunk?.sourceId === sourceId)?.decision ?? null;
}

export function createCandidateFromFixture(policy, fileName, partial) {
  return {
    ...partial,
    text: readFixture(fileName, policy),
  };
}

export function readFixture(fileName, policy) {
  const fixturePath = resolve(repoRoot, PUBLIC_KNOWLEDGE_FIXTURE_DIR, fileName);
  const statText = readFileSync(fixturePath, "utf8");
  if (Buffer.byteLength(statText, "utf8") > policy.maxFixtureBytes) {
    throw new Error(`Fixture exceeds Phase 277A maxFixtureBytes: ${fileName}`);
  }
  return statText;
}

export function readUpstreamStatus() {
  const cachePassed = evidencePassed("apps/ai-gateway-service/evidence/phase-275a-response-cache-hardening.json");
  const qualityCostPassed = evidencePassed("apps/ai-gateway-service/evidence/phase-276a-quality-cost-answer-router-preview.json");
  return {
    cacheHardeningAvailable: cachePassed,
    cacheHardeningDependencyStatus: cachePassed ? "passed" : "not_sealed",
    qualityCostRouterAvailable: qualityCostPassed,
    qualityCostRouterDependencyStatus: qualityCostPassed ? "passed" : "not_sealed",
  };
}

function evidencePassed(relativePath) {
  const absolutePath = resolve(repoRoot, relativePath);
  if (!existsSync(absolutePath)) return false;
  try {
    return JSON.parse(readFileSync(absolutePath, "utf8")).status === "passed";
  } catch {
    return false;
  }
}
