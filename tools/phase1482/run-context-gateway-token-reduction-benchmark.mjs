import {
  createConceptFieldSnapshot,
  createConceptFieldSyntheticSpace,
  runConceptFieldBenchmark,
} from "../../packages/taiji-beidou-engine/src/index.js";
import { benchmarkCases, cases, paths, phaseResult, writeJson } from "../phase1476_1485/phase1476-1485-common.mjs";

const space = createConceptFieldSyntheticSpace();
const snapshots = cases.map((entry) => createConceptFieldSnapshot(entry.input, { space }));
const baselineBenchmark = runConceptFieldBenchmark(benchmarkCases(), { space });
const totalTokenReplayEstimate = snapshots.reduce((sum, snapshot) => sum + snapshot.tokenReplayEstimate, 0);
const totalFieldSnapshotTokenEstimate = snapshots.reduce((sum, snapshot) => sum + snapshot.fieldSnapshotTokenEstimate, 0);
const tokenReductionRatio = Number(
  (1 - totalFieldSnapshotTokenEstimate / Math.max(1, totalTokenReplayEstimate)).toFixed(6),
);

const result = phaseResult("Phase1482", {
  phaseName: "Context Gateway Token Reduction Benchmark",
  contextGatewayTokenReductionBenchmark: true,
  tokenReplayVsFieldSnapshotBenchmark: true,
  benchmarkAgainstBaseline: true,
  totalTokenReplayEstimate,
  totalFieldSnapshotTokenEstimate,
  tokenReductionRatio,
  baselineBenchmark,
  realContextGatewayRuntimeModified: false,
});

writeJson(paths.phase1482, result);
console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  tokenReductionRatio: result.tokenReductionRatio,
}, null, 2));
