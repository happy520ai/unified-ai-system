import { ensurePhaseDirs, logResult, paths, writeDoc, writeText } from "./phase971-1000-common.mjs";

ensurePhaseDirs();
writeText(paths.soakAggregator, `import { existsSync, readFileSync } from "node:fs";

const days = Array.from({ length: 7 }, (_, index) => \`local-self-use/v1/soak/day-\${String(index + 1).padStart(2, "0")}.template.json\`);
const records = days
  .filter((path) => existsSync(path))
  .map((path) => JSON.parse(readFileSync(path, "utf8")));
const realLogs = records.filter((record) => record.isRealUseLog === true);
const result = {
  completed: true,
  recordsFound: records.length,
  realUseLogCount: realLogs.length,
  totalMinutesUsed: realLogs.reduce((sum, record) => sum + Number(record.minutesUsed || 0), 0),
  totalProviderRequests: realLogs.reduce((sum, record) => sum + Number(record.providerRequests || 0), 0),
  realSevenDaySoakCompleted: realLogs.length === 7,
};
console.log(JSON.stringify(result, null, 2));
`);
const result = {
  phase: "Phase993",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  soakMetricsAggregatorReady: true,
  realSevenDaySoakCompleted: false,
};
writeDoc("docs/phase971-1000/phase993-soak-metrics-aggregator.md", {
  title: "Phase993 Soak Metrics Aggregator",
  goal: "Create aggregator that refuses to treat templates as completed real soak.",
  facts: [`soakMetricsAggregatorReady=${result.soakMetricsAggregatorReady}`],
  boundaries: ["No fake soak data."],
  outputs: [paths.soakAggregator],
});
logResult(result);
