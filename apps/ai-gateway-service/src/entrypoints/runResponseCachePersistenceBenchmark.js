import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RESPONSE_CACHE_EVIDENCE_MD_RELATIVE_PATH,
  RESPONSE_CACHE_EVIDENCE_RELATIVE_PATH,
  buildResponseCachePersistenceBenchmark,
  renderResponseCachePersistenceMarkdown,
} from "../cache/responseCacheBenchmark.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceJsonPath = resolve(repoRoot, RESPONSE_CACHE_EVIDENCE_RELATIVE_PATH);
const evidenceMdPath = resolve(repoRoot, RESPONSE_CACHE_EVIDENCE_MD_RELATIVE_PATH);

try {
  const evidence = await buildResponseCachePersistenceBenchmark({ repoRoot });
  await mkdir(dirname(evidenceJsonPath), { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, renderResponseCachePersistenceMarkdown(evidence), "utf8");

  console.log(JSON.stringify({
    phase: evidence.phase,
    status: evidence.status,
    conclusion: evidence.conclusion,
    mode: evidence.mode,
    caseCount: evidence.summary.caseCount,
    hitCount: evidence.summary.hitCount,
    missCount: evidence.summary.missCount,
    writeSucceededCount: evidence.summary.writeSucceededCount,
    writeSkippedCount: evidence.summary.writeSkippedCount,
    secretRejectedCount: evidence.summary.secretRejectedCount,
    estimatedApiTokensSaved: evidence.summary.estimatedApiTokensSaved,
    estimatedCostSavedUsd: evidence.summary.estimatedCostSavedUsd,
    paidApiCallCount: evidence.paidApiCallCount,
    externalApiCalled: evidence.externalApiCalled,
    mimoApiCalled: evidence.mimoApiCalled,
    evidenceJsonPath,
    evidenceMdPath,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    phase: "274A-response-cache-persistence",
    status: "failed",
    blocker: error instanceof Error ? error.message : String(error),
    paidApiCallCount: 0,
    externalApiCalled: false,
    mimoApiCalled: false,
  }, null, 2));
  process.exitCode = 1;
}
