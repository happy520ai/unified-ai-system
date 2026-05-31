import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRagSourceSelectionBenchmark,
  PHASE_273_EVIDENCE_MD_RELATIVE_PATH,
  PHASE_273_EVIDENCE_RELATIVE_PATH,
  renderRagSourceSelectionBenchmarkMarkdown,
} from "../rag/sourceSelectionBenchmark.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceJsonPath = resolve(repoRoot, PHASE_273_EVIDENCE_RELATIVE_PATH);
const evidenceMdPath = resolve(repoRoot, PHASE_273_EVIDENCE_MD_RELATIVE_PATH);

try {
  const evidence = buildRagSourceSelectionBenchmark({ repoRoot });
  await mkdir(dirname(evidenceJsonPath), { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, renderRagSourceSelectionBenchmarkMarkdown(evidence), "utf8");
  console.log(JSON.stringify({
    phase: evidence.phase,
    status: evidence.status,
    conclusion: evidence.conclusion,
    mode: evidence.mode,
    caseCount: evidence.caseCount,
    paidApiCallCount: evidence.paidApiCallCount,
    externalApiCalled: evidence.externalApiCalled,
    mimoApiCalled: evidence.mimoApiCalled,
    averageSavingsRatio: evidence.summary.averageSavingsRatio,
    estimatedTotalTokensSaved: evidence.summary.estimatedTotalTokensSaved,
    averageRequiredSourceRecall: evidence.summary.averageRequiredSourceRecall,
    latestEvidenceHitRate: evidence.summary.latestEvidenceHitRate,
    staleSourceSelectedCount: evidence.summary.staleSourceSelectedCount,
    evidenceJsonPath,
    evidenceMdPath,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    phase: "273A-rag-source-selection-benchmark",
    status: "failed",
    blocker: error instanceof Error ? error.message : String(error),
    paidApiCallCount: 0,
    externalApiCalled: false,
    mimoApiCalled: false,
  }, null, 2));
  process.exitCode = 1;
}
