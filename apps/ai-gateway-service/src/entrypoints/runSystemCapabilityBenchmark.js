import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  renderSystemCapabilityBenchmarkMarkdown,
  runSystemCapabilityBenchmark,
} from "../benchmarks/systemCapabilityBenchmark.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-274a-system-capability-benchmark.json");
const evidenceMdPath = resolve(evidenceDir, "phase-274a-system-capability-benchmark.md");

try {
  const evidence = runSystemCapabilityBenchmark({ repoRoot });
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, renderSystemCapabilityBenchmarkMarkdown(evidence), "utf8");
  console.log(JSON.stringify({
    phase: evidence.phase,
    status: evidence.status,
    conclusion: evidence.conclusion,
    totalScore: evidence.scorecard.totalScore,
    grade: evidence.scorecard.grade,
    productionReadiness: evidence.scorecard.productionReadiness,
    paidApiCallCount: evidence.paidApiCallCount,
    externalApiCalled: evidence.externalApiCalled,
    mimoApiCalled: evidence.mimoApiCalled,
    evidenceJsonPath,
    evidenceMdPath,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    phase: "274A-system-capability-benchmark",
    status: "failed",
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exitCode = 1;
}
