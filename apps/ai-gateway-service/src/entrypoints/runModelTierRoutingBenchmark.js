import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PHASE_276A_JSON_RELATIVE_PATH,
  PHASE_276A_MD_RELATIVE_PATH,
  renderModelTierRoutingMarkdown,
  runModelTierRoutingBenchmark,
} from "../routing/modelTierRoutingBenchmark.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

async function main() {
  const evidence = runModelTierRoutingBenchmark();
  const jsonPath = resolve(repoRoot, PHASE_276A_JSON_RELATIVE_PATH);
  const mdPath = resolve(repoRoot, PHASE_276A_MD_RELATIVE_PATH);

  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(mdPath, renderModelTierRoutingMarkdown(evidence), "utf8");

  console.log(JSON.stringify({
    phase: evidence.phase,
    status: evidence.status,
    conclusion: evidence.conclusion,
    caseCount: evidence.summary.caseCount,
    ruleOnlyCount: evidence.summary.ruleOnlyCount,
    cacheOnlyCount: evidence.summary.cacheOnlyCount,
    ragLocalCount: evidence.summary.ragLocalCount,
    premiumMimoRecommendationCount: evidence.summary.premiumMimoRecommendationCount,
    requireApprovalCount: evidence.summary.requireApprovalCount,
    blockCount: evidence.summary.blockCount,
    paidApiCallCount: evidence.paidApiCallCount,
    externalApiCalled: evidence.externalApiCalled,
    mimoApiCalled: evidence.mimoApiCalled,
    evidenceJsonPath: PHASE_276A_JSON_RELATIVE_PATH,
    evidenceMdPath: PHASE_276A_MD_RELATIVE_PATH,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
