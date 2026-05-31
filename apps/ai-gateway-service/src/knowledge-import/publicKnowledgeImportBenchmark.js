import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chunkPublicKnowledgeDocument } from "./publicKnowledgeChunker.js";
import { cleanPublicKnowledgeText } from "./publicKnowledgeCleaner.js";
import {
  addAcceptedCandidateToBatchIndex,
  buildCurrentBatchIndex,
  buildPrivateKnowledgePreviewIndex,
  buildPublicKnowledgePreviewIndex,
} from "./publicKnowledgeDedupIndex.js";
import { buildPublicKnowledgeIndexPreview, createRagSourceSelectionBridge } from "./publicKnowledgeIndexPreview.js";
import { createPublicKnowledgeImportPolicy, createPublicKnowledgePriorityRules } from "./publicKnowledgeImportPolicy.js";
import {
  createEmptyCase,
  PUBLIC_KNOWLEDGE_EVIDENCE_JSON,
  PUBLIC_KNOWLEDGE_EVIDENCE_MD,
  PUBLIC_KNOWLEDGE_FIXTURE_DIR,
  PUBLIC_KNOWLEDGE_MODE,
  PUBLIC_KNOWLEDGE_PHASE,
  PUBLIC_KNOWLEDGE_SAFETY,
} from "./publicKnowledgeImportTypes.js";
import { createManifestSummary, createPublicKnowledgeManifest, getPublicKnowledgeSource } from "./publicKnowledgeManifest.js";
import { evaluatePublicKnowledgeNovelty } from "./publicKnowledgeNoveltyGuard.js";
import { compareProjectEvidenceWithPublicKnowledge, scorePublicKnowledgeSource } from "./publicKnowledgeSourceTrust.js";
import { importGutenbergTextPreview } from "./adapters/gutenbergTextAdapterPreview.js";
import { importKiwixZimSamplePreview } from "./adapters/kiwixZimAdapterPreview.js";
import { importWikidataJsonPreview } from "./adapters/wikidataJsonAdapterPreview.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

export function runPublicKnowledgeImportPreview() {
  const generatedAt = new Date().toISOString();
  const policy = createPublicKnowledgeImportPolicy();
  const manifest = createPublicKnowledgeManifest();
  const importResult = runFixtureImports(policy, manifest);
  const noveltyPreview = runNoveltyPreview(policy, importResult);
  const acceptedChunks = noveltyPreview.acceptedChunks.map((item) => item.chunk);
  const indexPreview = buildPublicKnowledgeIndexPreview({
    documents: importResult.documents,
    chunks: acceptedChunks,
    manifest,
  });
  const enrichedImportResult = {
    ...importResult,
    indexPreview,
    acceptedChunks,
  };
  const cases = createBenchmarkCases({
    policy,
    manifest,
    importResult: enrichedImportResult,
    noveltyPreview,
  });
  const summary = summarizeCases(cases, enrichedImportResult);

  return {
    phase: PUBLIC_KNOWLEDGE_PHASE,
    status: summary.failCount === 0 ? "passed" : "failed",
    conclusion: summary.failCount === 0
      ? "public-knowledge-import-preview-with-multi-layer-novelty-guard-ready"
      : "public-knowledge-import-preview-with-multi-layer-novelty-guard-needs-repair",
    generatedAt,
    mode: PUBLIC_KNOWLEDGE_MODE,
    autoDownloadEnabled: false,
    fullDatasetImportEnabled: false,
    paidApiCallCount: 0,
    externalApiCalled: false,
    mimoApiCalled: false,
    embeddingApiCalled: false,
    llmCleaningCalled: false,
    defaultNvidiaChatLaneChanged: false,
    mimoSetAsDefault: false,
    policy,
    upstream: readUpstreamStatus(),
    manifest: createManifestSummary(manifest),
    summary,
    cases,
    publicKnowledgePriorityRules: createPublicKnowledgePriorityRules(),
    noveltyGuard: {
      enabled: true,
      mode: "deterministic-preview",
      checkPrivateKnowledgeIndex: true,
      checkPublicKnowledgeIndex: true,
      checkCurrentBatchIndex: true,
      rejectPrivateDuplicate: true,
      rejectPublicDuplicate: true,
      rejectBatchDuplicate: true,
      nearDuplicateRequiresReview: true,
      nearDuplicateAutoIngestAllowed: false,
      onlyNewKnowledgeCanBeImported: true,
      embeddingUsed: false,
      semanticModelUsed: false,
      decisions: noveltyPreview.decisions.map((item) => ({
        label: item.label,
        noveltyDecision: item.decision.noveltyDecision,
        acceptedForImport: item.decision.acceptedForImport,
        reviewRequired: item.decision.reviewRequired,
        duplicateLayer: item.decision.duplicateLayer,
        nearDuplicateScore: item.decision.nearDuplicateScore,
      })),
    },
    sourceTrustScoreRules: {
      projectEvidenceTrustScore: 0.95,
      wikipediaKiwixSnapshotTrustScore: scorePublicKnowledgeSource({ family: "kiwix-zim" }).trustScore,
      projectGutenbergTrustScore: scorePublicKnowledgeSource({ family: "project-gutenberg" }).trustScore,
      wikidataTrustScore: scorePublicKnowledgeSource({ family: "wikidata-json" }).trustScore,
      unknownSourceTrustScore: scorePublicKnowledgeSource({ family: "unknown_source" }).trustScore,
      lowTrustWebTrustScore: scorePublicKnowledgeSource({ family: "low_trust_web" }).trustScore,
      publicKnowledgeCannotOverrideProjectEvidence: true,
      lowTrustRejectedByDefault: true,
      unknownSourceRejectedByDefault: true,
    },
    indexPreview,
    ragSourceSelectionPreview: importResult.ragBridge,
    recommendedNextRoutes: [
      {
        route: "Phase 278A Free Model Assisted Daily Knowledge Enrichment Pipeline",
        reason: "The import preview and deterministic novelty guard are ready; a next preview can add free-model-assisted enrichment with rate limits, daily budget, authoritative sources, cleaning, dedup, and ledger boundaries.",
        paidApiExpansionRecommended: false,
      },
      {
        route: "Public Knowledge License Attribution Preview",
        reason: "Add source-specific attribution manifest checks before real public corpus imports.",
        paidApiExpansionRecommended: false,
      },
    ],
    gaps: [
      "No real ZIM parser is integrated.",
      "No large ZIM, Wikidata dump, or Gutenberg corpus import was performed.",
      "No embedding or vector index exists.",
      "No incremental update pipeline exists.",
      "No automated license attribution engine exists.",
      "No disk budget planner exists.",
      "No production-grade semantic dedup exists.",
      "No public knowledge QA quality evaluation exists.",
      "Quality-Cost Router integration is metadata-only.",
    ],
    safety: PUBLIC_KNOWLEDGE_SAFETY,
  };
}

export function renderPublicKnowledgeImportMarkdown(evidence) {
  const summary = evidence.summary;
  const lines = [
    "# Phase 277A Public Knowledge Library Import Preview with Multi-layer Novelty Guard",
    "",
    "## Summary",
    `- status: ${evidence.status}`,
    `- conclusion: ${evidence.conclusion}`,
    `- mode: ${evidence.mode}`,
    `- autoDownloadEnabled: ${evidence.autoDownloadEnabled}`,
    `- fullDatasetImportEnabled: ${evidence.fullDatasetImportEnabled}`,
    `- paidApiCallCount: ${evidence.paidApiCallCount}`,
    `- externalApiCalled: ${evidence.externalApiCalled}`,
    `- mimoApiCalled: ${evidence.mimoApiCalled}`,
    `- embeddingApiCalled: ${evidence.embeddingApiCalled}`,
    `- llmCleaningCalled: ${evidence.llmCleaningCalled}`,
    "",
    "## Metrics",
    `- sourceFamilyCount: ${evidence.manifest.sourceFamilyCount}`,
    `- documentsImported: ${summary.documentsImported}`,
    `- chunksCreated: ${summary.chunksCreated}`,
    `- entitiesParsed: ${summary.entitiesParsed}`,
    `- keywordIndexBuilt: ${summary.keywordIndexBuilt}`,
    `- embeddingIndexBuilt: ${summary.embeddingIndexBuilt}`,
    `- vectorIndexBuilt: ${summary.vectorIndexBuilt}`,
    `- secretRejectedCount: ${summary.secretRejectedCount}`,
    `- privateDuplicateRejectedCount: ${summary.privateDuplicateRejectedCount}`,
    `- publicDuplicateRejectedCount: ${summary.publicDuplicateRejectedCount}`,
    `- batchDuplicateRejectedCount: ${summary.batchDuplicateRejectedCount}`,
    `- nearDuplicateReviewRequiredCount: ${summary.nearDuplicateReviewRequiredCount}`,
    `- newKnowledgeAcceptedCount: ${summary.newKnowledgeAcceptedCount}`,
    `- passCount: ${summary.passCount}`,
    `- warnCount: ${summary.warnCount}`,
    `- failCount: ${summary.failCount}`,
    "",
    "## Case Matrix",
    "| caseId | sourceFamily | noveltyDecision | accepted | reviewRequired | status |",
    "| --- | --- | --- | --- | --- | --- |",
    ...evidence.cases.map((item) => `| ${item.caseId} | ${item.sourceFamily} | ${item.noveltyDecision} | ${item.acceptedForImport} | ${item.reviewRequired} | ${item.status} |`),
    "",
    "## Novelty Guard",
    "- Private knowledge duplicates are rejected before import.",
    "- Public knowledge duplicates are rejected before import.",
    "- Current batch duplicates are rejected before import.",
    "- Near duplicates require review and are not auto-imported.",
    "- Only `noveltyDecision=new` can have `acceptedForImport=true`.",
    "- This guard is deterministic preview logic and not production-grade semantic dedup.",
    "",
    "## Safety",
    "- No large public dataset was downloaded.",
    "- No full Wikipedia, Wikidata, or Gutenberg import was performed.",
    "- No MiMo API, paid API, embedding, semantic model, or LLM cleaning was called.",
    "- Public knowledge is background context and cannot override project phase evidence.",
    "- Duplicate private, public, and batch knowledge was not imported.",
    "- Near duplicates were not auto-imported.",
    "- This is a local import preview, not a production public knowledge library.",
  ];
  return `${lines.join("\n")}\n`;
}

function runFixtureImports(policy, manifest) {
  const gutenbergSource = getPublicKnowledgeSource("project-gutenberg-preview", manifest);
  const kiwixSource = getPublicKnowledgeSource("kiwix-wikipedia-preview", manifest);
  const wikidataSource = getPublicKnowledgeSource("wikidata-json-preview", manifest);

  const gutenberg = importGutenbergTextPreview({
    source: gutenbergSource,
    text: readFixture("gutenberg-sample.txt", policy),
  });
  const wikipedia = importKiwixZimSamplePreview({
    source: kiwixSource,
    html: readFixture("wikipedia-sample.html", policy),
    title: "Albert Einstein",
  });
  const wikidata = importWikidataJsonPreview({
    source: wikidataSource,
    json: readFixture("wikidata-sample.json", policy),
  });
  const documents = [gutenberg.document, wikipedia.document].filter(Boolean);
  const chunkGroups = documents.map((document) => chunkPublicKnowledgeDocument(document, policy));
  const chunks = chunkGroups.flatMap((group) => group.chunks);
  const indexPreview = buildPublicKnowledgeIndexPreview({ documents, chunks, manifest });
  const ragBridge = createRagSourceSelectionBridge({
    query: "Who was Albert Einstein?",
    chunks: chunks.filter((chunk) => /einstein|physicist|relativity/i.test(chunk.text)),
    projectEvidenceSources: [
      { path: "apps/ai-gateway-service/evidence/phase-274a-system-capability-benchmark.json", rank: "project-authoritative" },
    ],
  });
  const secretCleaner = cleanPublicKnowledgeText({
    rawText: readFixture("secret-like-sample.txt", policy),
    sourceFamily: "fixture-secret-test",
  });

  return {
    documents,
    chunks,
    gutenberg,
    wikipedia,
    wikidata,
    indexPreview,
    ragBridge,
    secretCleaner,
  };
}

function runNoveltyPreview(policy, importResult) {
  const privateKnowledgeIndex = buildPrivateKnowledgePreviewIndex();
  const publicKnowledgeIndex = buildPublicKnowledgePreviewIndex();
  let currentBatchIndex = buildCurrentBatchIndex();
  const decisions = [];
  const acceptedChunks = [];

  for (const chunk of importResult.chunks) {
    const candidate = {
      ...chunk,
      sourceCanonicalId: `${chunk.sourceId}:${chunk.documentId}`,
    };
    const decision = evaluatePublicKnowledgeNovelty({
      candidateChunk: candidate,
      privateKnowledgeIndex,
      publicKnowledgeIndex,
      currentBatchIndex,
    });
    decisions.push({ label: `${chunk.sourceId}:${chunk.chunkIndex}`, chunk, decision });
    if (decision.acceptedForImport) {
      currentBatchIndex = addAcceptedCandidateToBatchIndex(currentBatchIndex, candidate);
      acceptedChunks.push({ chunk, decision });
    }
  }

  const privateDuplicateCandidate = createCandidateFromFixture(policy, "private-duplicate-sample.txt", {
    sourceId: "fixture-private-duplicate",
    documentId: "fixture-private-duplicate:doc",
    chunkId: "fixture-private-duplicate:doc:chunk-1",
    title: "Current project status",
    sourceCanonicalId: "fixture:private-duplicate",
    sourceTrustScore: 0.95,
  });
  const privateDuplicate = evaluatePublicKnowledgeNovelty({
    candidateChunk: privateDuplicateCandidate,
    privateKnowledgeIndex,
    publicKnowledgeIndex: [],
    currentBatchIndex: [],
  });
  decisions.push({ label: "private-duplicate", chunk: privateDuplicateCandidate, decision: privateDuplicate });

  const publicDuplicateCandidate = createCandidateFromFixture(policy, "public-duplicate-sample.txt", {
    sourceId: "fixture-public-duplicate",
    documentId: "fixture-public-duplicate:doc",
    chunkId: "fixture-public-duplicate:doc:chunk-1",
    title: "Albert Einstein",
    sourceCanonicalId: "fixture:public-duplicate",
    sourceTrustScore: 0.75,
  });
  const publicDuplicate = evaluatePublicKnowledgeNovelty({
    candidateChunk: publicDuplicateCandidate,
    privateKnowledgeIndex: [],
    publicKnowledgeIndex,
    currentBatchIndex: [],
  });
  decisions.push({ label: "public-duplicate", chunk: publicDuplicateCandidate, decision: publicDuplicate });

  const batchDuplicateCandidate = createCandidateFromFixture(policy, "current-batch-duplicate-sample.txt", {
    sourceId: "fixture-current-batch",
    documentId: "fixture-current-batch:doc",
    chunkId: "fixture-current-batch:doc:chunk-1",
    title: "Current batch local keyword indexing",
    sourceCanonicalId: "fixture:current-batch-duplicate",
    sourceTrustScore: 0.75,
  });
  const seededBatchIndex = addAcceptedCandidateToBatchIndex([], batchDuplicateCandidate);
  const batchDuplicate = evaluatePublicKnowledgeNovelty({
    candidateChunk: batchDuplicateCandidate,
    privateKnowledgeIndex: [],
    publicKnowledgeIndex: [],
    currentBatchIndex: seededBatchIndex,
  });
  decisions.push({ label: "current-batch-duplicate", chunk: batchDuplicateCandidate, decision: batchDuplicate });

  const nearDuplicateCandidate = createCandidateFromFixture(policy, "near-duplicate-sample.txt", {
    sourceId: "fixture-near-duplicate",
    documentId: "fixture-near-duplicate:doc",
    chunkId: "fixture-near-duplicate:doc:chunk-1",
    title: "Albert Einstein",
    sourceCanonicalId: "fixture:near-duplicate",
    sourceTrustScore: 0.75,
  });
  const nearDuplicate = evaluatePublicKnowledgeNovelty({
    candidateChunk: nearDuplicateCandidate,
    privateKnowledgeIndex: [],
    publicKnowledgeIndex,
    currentBatchIndex: [],
  });
  decisions.push({ label: "near-duplicate", chunk: nearDuplicateCandidate, decision: nearDuplicate });

  const lowTrust = scorePublicKnowledgeSource({ family: "low_trust_web" });

  return {
    privateKnowledgeIndex,
    publicKnowledgeIndex,
    currentBatchIndex,
    acceptedChunks,
    decisions,
    privateDuplicate,
    publicDuplicate,
    batchDuplicate,
    nearDuplicate,
    lowTrust,
  };
}

function createBenchmarkCases({ manifest, importResult, noveltyPreview }) {
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

function summarizeCases(cases, importResult) {
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

function createCandidateFromFixture(policy, fileName, partial) {
  return {
    ...partial,
    text: readFixture(fileName, policy),
  };
}

function readFixture(fileName, policy) {
  const fixturePath = resolve(repoRoot, PUBLIC_KNOWLEDGE_FIXTURE_DIR, fileName);
  const statText = readFileSync(fixturePath, "utf8");
  if (Buffer.byteLength(statText, "utf8") > policy.maxFixtureBytes) {
    throw new Error(`Fixture exceeds Phase 277A maxFixtureBytes: ${fileName}`);
  }
  return statText;
}

function readUpstreamStatus() {
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

export { PUBLIC_KNOWLEDGE_EVIDENCE_JSON, PUBLIC_KNOWLEDGE_EVIDENCE_MD };
