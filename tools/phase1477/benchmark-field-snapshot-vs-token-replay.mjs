import {
  createConceptFieldSnapshot,
  createConceptFieldSyntheticSpace,
  runConceptFieldBenchmark,
} from "../../packages/taiji-beidou-engine/src/index.js";
import { benchmarkCases, cases, paths, phaseResult, writeJson } from "../phase1476_1485/phase1476-1485-common.mjs";

const space = createConceptFieldSyntheticSpace();
const snapshots = cases.map((entry) => ({
  caseId: entry.caseId,
  title: entry.title,
  snapshot: createConceptFieldSnapshot(entry.input, { space }),
}));
const baselineBenchmark = runConceptFieldBenchmark(benchmarkCases(), { space });
const result = phaseResult("Phase1477", {
  phaseName: "Field Snapshot vs Token Replay Benchmark",
  fieldSnapshotGenerated: true,
  tokenReplayVsFieldSnapshotBenchmark: true,
  benchmarkAgainstBaseline: true,
  randomBaselineGenerated: true,
  keywordBaselineGenerated: true,
  nearestNeighborBaselineGenerated: true,
  conceptFieldKernelBaselineGenerated: true,
  snapshots,
  baselineBenchmark,
  averageTokenReductionRatio: average(snapshots.map((entry) => entry.snapshot.tokenReductionRatio)),
  notes: [
    "Token counts are deterministic estimates for dry-run comparison.",
    "No real semantic compression or production memory is claimed.",
  ],
});

writeJson(paths.phase1477, result);
console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  averageTokenReductionRatio: result.averageTokenReductionRatio,
  benchmarkAgainstBaseline: result.benchmarkAgainstBaseline,
}, null, 2));

function average(values) {
  return Number((values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)).toFixed(6));
}
