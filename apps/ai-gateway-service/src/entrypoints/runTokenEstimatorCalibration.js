import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildTokenEstimatorCalibrationEvidence,
  PHASE_272_EVIDENCE_MD_RELATIVE_PATH,
  PHASE_272_EVIDENCE_RELATIVE_PATH,
  renderTokenEstimatorCalibrationMarkdown,
} from "../cost/tokenEstimatorCalibration.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceJsonPath = resolve(repoRoot, PHASE_272_EVIDENCE_RELATIVE_PATH);
const evidenceMdPath = resolve(repoRoot, PHASE_272_EVIDENCE_MD_RELATIVE_PATH);

try {
  const evidence = buildTokenEstimatorCalibrationEvidence({ repoRoot });
  await mkdir(dirname(evidenceJsonPath), { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, renderTokenEstimatorCalibrationMarkdown(evidence), "utf8");
  console.log(JSON.stringify({
    phase: evidence.phase,
    status: evidence.status,
    conclusion: evidence.conclusion,
    provider: evidence.provider,
    model: evidence.model,
    sampleCount: evidence.sampleCount,
    paidApiCallCount: evidence.paidApiCallCount,
    externalApiCalled: evidence.externalApiCalled,
    averageInputTokenErrorRatio: evidence.summary.averageInputTokenErrorRatio,
    averageOutputTokenErrorRatio: evidence.summary.averageOutputTokenErrorRatio,
    averageTotalTokenErrorRatio: evidence.summary.averageTotalTokenErrorRatio,
    estimatorBias: evidence.summary.estimatorBias,
    recommendedInputSafetyMultiplier: evidence.calibrationProfile.recommendedInputSafetyMultiplier,
    recommendedOutputSafetyMultiplier: evidence.calibrationProfile.recommendedOutputSafetyMultiplier,
    recommendedTotalSafetyMultiplier: evidence.calibrationProfile.recommendedTotalSafetyMultiplier,
    recommendedMinimumInputTokenFloor: evidence.calibrationProfile.recommendedMinimumInputTokenFloor,
    recommendedMinimumTotalTokenFloor: evidence.calibrationProfile.recommendedMinimumTotalTokenFloor,
    evidenceJsonPath,
    evidenceMdPath,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    phase: "272A-token-estimator-calibration",
    status: "blocked",
    blocker: error instanceof Error ? error.message : String(error),
    paidApiCallCount: 0,
    externalApiCalled: false,
  }, null, 2));
  process.exitCode = 1;
}
