import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { chunkPublicKnowledgeDocument } from "./publicKnowledgeChunker.js";
import { cleanPublicKnowledgeText } from "./publicKnowledgeCleaner.js";
import {
  buildPublicKnowledgeIndexPreview,
  createRagSourceSelectionBridge,
} from "./publicKnowledgeIndexPreview.js";
import { PUBLIC_KNOWLEDGE_FIXTURE_DIR } from "./publicKnowledgeImportTypes.js";
import { getPublicKnowledgeSource } from "./publicKnowledgeManifest.js";
import { importGutenbergTextPreview } from "./adapters/gutenbergTextAdapterPreview.js";
import { importKiwixZimSamplePreview } from "./adapters/kiwixZimAdapterPreview.js";
import { importWikidataJsonPreview } from "./adapters/wikidataJsonAdapterPreview.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

export function readFixture(fileName, policy) {
  const fixturePath = resolve(repoRoot, PUBLIC_KNOWLEDGE_FIXTURE_DIR, fileName);
  const statText = readFileSync(fixturePath, "utf8");
  if (Buffer.byteLength(statText, "utf8") > policy.maxFixtureBytes) {
    throw new Error(`Fixture exceeds Phase 277A maxFixtureBytes: ${fileName}`);
  }
  return statText;
}

export function createCandidateFromFixture(policy, fileName, partial) {
  return {
    ...partial,
    text: readFixture(fileName, policy),
  };
}

export function runFixtureImports(policy, manifest) {
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

export function applyNovelty(target, decision) {
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

export function findChunkDecision(noveltyPreview, sourceId) {
  return noveltyPreview.decisions.find((item) => item.chunk?.sourceId === sourceId)?.decision ?? null;
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
