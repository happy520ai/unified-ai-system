import { writeJson, writeText } from "../phase371-common.mjs";

const checklist = {
  phase: "Phase371E",
  observationCommands: [
    "pnpm start:pme",
    "pnpm dev:phase7b",
    "pnpm status:phase10a",
    "pnpm logs:phase16a",
    "pnpm stop:phase9c",
    "pnpm idle:phase15a",
    "pnpm restart:phase11a",
    "pnpm health:phase12a",
    "pnpm run verify:phase107a-secret-safety",
    "pnpm run verify:phase321a-workbench-product-recovery",
    "pnpm run verify:phase322a-workbench-chat-gateway-real-nvidia",
    "pnpm -r --if-present check",
  ],
  observationFocus: [
    "runtime 是否启动",
    "service health",
    "Workbench 可访问性",
    "Chat 主链是否可用",
    "Normal Mode 可用性",
    "God/Tianshu UI candidate 可见性",
    "secret 是否未暴露",
    "logs 是否可查看",
    "stop/restart 是否安全",
    "观察时长建议",
    "已知限制",
  ],
};

const state = {
  phase: "Phase371E",
  longRunObservationPlanGenerated: true,
  localRuntimeActivationOnly: true,
  productionDeployClaimed: false,
  runtimeStartedByThisPhase: false,
  longRunExecuted: false,
  manualObservationRequired: true,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  secretValueExposed: false,
};

await writeText(
  "docs/phase371e-internal-test-runtime-long-run-plan.md",
  [
    "# Phase371E Internal Test Runtime Long-run Plan",
    "",
    "- local runtime activation only",
    "- recommended observation window: 30-120 minutes",
    "- no production deploy claim",
    "- no GA claim",
  ].join("\n"),
);
await writeJson("docs/phase371e-internal-test-runtime-observation-checklist.json", checklist);
await writeText(
  "docs/phase371e-runtime-status-observation-report.md",
  [
    "# Phase371E Runtime Status Observation Report",
    "",
    "- long-run not executed in this phase",
    "- manual observation still required",
    "- use status/logs/health/verify commands as local/internal observation only",
  ].join("\n"),
);
await writeText(
  "docs/phase371e-execution-report.md",
  [
    "# Phase371E Execution Report",
    "",
    "- longRunObservationPlanGenerated: true",
    "- runtimeStartedByThisPhase: false",
    "- longRunExecuted: false",
  ].join("\n"),
);
await writeJson(
  "apps/ai-gateway-service/evidence/phase371e/internal-test-runtime-long-run-observation-result.json",
  state,
);

console.log(JSON.stringify(state, null, 2));
