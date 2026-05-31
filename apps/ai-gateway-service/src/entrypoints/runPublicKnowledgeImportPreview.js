import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PUBLIC_KNOWLEDGE_EVIDENCE_JSON,
  PUBLIC_KNOWLEDGE_EVIDENCE_MD,
  renderPublicKnowledgeImportMarkdown,
  runPublicKnowledgeImportPreview,
} from "../knowledge-import/publicKnowledgeImportBenchmark.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

async function main() {
  const evidence = runPublicKnowledgeImportPreview();
  const jsonPath = resolve(repoRoot, PUBLIC_KNOWLEDGE_EVIDENCE_JSON);
  const mdPath = resolve(repoRoot, PUBLIC_KNOWLEDGE_EVIDENCE_MD);

  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(mdPath, renderPublicKnowledgeImportMarkdown(evidence), "utf8");

  console.log(JSON.stringify({
    phase: evidence.phase,
    status: evidence.status,
    conclusion: evidence.conclusion,
    mode: evidence.mode,
    sourceFamilyCount: evidence.manifest.sourceFamilyCount,
    documentsImported: evidence.summary.documentsImported,
    chunksCreated: evidence.summary.chunksCreated,
    entitiesParsed: evidence.summary.entitiesParsed,
    keywordIndexBuilt: evidence.summary.keywordIndexBuilt,
    embeddingIndexBuilt: evidence.summary.embeddingIndexBuilt,
    vectorIndexBuilt: evidence.summary.vectorIndexBuilt,
    secretRejectedCount: evidence.summary.secretRejectedCount,
    privateDuplicateRejectedCount: evidence.summary.privateDuplicateRejectedCount,
    publicDuplicateRejectedCount: evidence.summary.publicDuplicateRejectedCount,
    batchDuplicateRejectedCount: evidence.summary.batchDuplicateRejectedCount,
    nearDuplicateReviewRequiredCount: evidence.summary.nearDuplicateReviewRequiredCount,
    newKnowledgeAcceptedCount: evidence.summary.newKnowledgeAcceptedCount,
    paidApiCallCount: evidence.paidApiCallCount,
    externalApiCalled: evidence.externalApiCalled,
    mimoApiCalled: evidence.mimoApiCalled,
    embeddingApiCalled: evidence.embeddingApiCalled,
    llmCleaningCalled: evidence.llmCleaningCalled,
    evidenceJsonPath: PUBLIC_KNOWLEDGE_EVIDENCE_JSON,
    evidenceMdPath: PUBLIC_KNOWLEDGE_EVIDENCE_MD,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
