import { writeJson, writeText } from "../phase369-common.mjs";

const commandGroups = {
  phase: "Phase369E",
  localRuntimeActivation: [
    "pnpm start:pme",
    "pnpm dev:phase7b",
    "pnpm start:ai-gateway-service",
    "pnpm start:agent-console",
  ],
  safeStopOrStatus: [
    "pnpm stop:phase9c",
    "pnpm status:phase10a",
    "pnpm logs:phase16a",
    "pnpm idle:phase15a",
    "pnpm restart:phase11a",
  ],
  verification: [
    "pnpm run verify:phase107a-secret-safety",
    "pnpm run verify:phase321a-workbench-product-recovery",
    "pnpm -r --if-present check",
    "pnpm run verify:phase322a-workbench-chat-gateway-real-nvidia",
  ],
};

const result = {
  phase: "Phase369E",
  localLongRunningGuideGenerated: true,
  internalTestBoundaryGenerated: true,
  localRuntimeActivationOnly: true,
  productionDeployClaimed: false,
  productionGaAuthorized: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  secretValueExposed: false,
};

await writeText(
  "docs/phase369e-local-long-running-internal-test-guide.md",
  [
    "# Phase369E Local Long-running Internal Test Guide",
    "",
    "- Use local runtime activation commands only for local or internal test operation.",
    "- Long-running local process is not production deploy.",
    "- Internal test environment is not production GA.",
    "- No tag creation, release, or artifact upload is implied by runtime startup.",
  ].join("\n"),
);
await writeJson("docs/phase369e-local-runtime-activation-commands.json", commandGroups);
await writeText(
  "docs/phase369e-internal-test-environment-boundary.md",
  [
    "# Phase369E Internal Test Environment Boundary",
    "",
    "- local runtime activation != production deploy",
    "- internal test environment != production GA",
    "- long-running local process != release",
    "- no public user exposure by default",
  ].join("\n"),
);
await writeText(
  "docs/phase369e-no-production-deploy-runtime-guide.md",
  [
    "# Phase369E No-production-deploy Runtime Guide",
    "",
    "This guide is for local/internal runtime only. It does not authorize deploy or production rollout.",
  ].join("\n"),
);
await writeText(
  "docs/phase369e-execution-report.md",
  [
    "# Phase369E Execution Report",
    "",
    "- localLongRunningGuideGenerated: true",
    "- productionDeployClaimed: false",
  ].join("\n"),
);
await writeJson(
  "apps/ai-gateway-service/evidence/phase369e/local-long-running-internal-test-guide-result.json",
  result,
);

console.log(JSON.stringify(result, null, 2));
