import { writeJson, writeText } from "../phase368-common.mjs";

const commandClassification = {
  phase: "Phase368B",
  classifications: {
    local_runtime_activation: [
      "pnpm start:pme",
      "pnpm dev:phase7b",
      "pnpm start:ai-gateway-service",
      "pnpm start:agent-console",
    ],
    verification_only: [
      "pnpm -r --if-present check",
      "pnpm run verify:*",
      "pnpm run smoke:*",
    ],
    build_only: ["pnpm run build", "pnpm build"],
    not_deploy: [
      "check",
      "verify",
      "smoke",
      "build",
      "start local",
      "dev local",
    ],
    production_deploy: [
      "explicit deploy adapter",
      "explicit deploy script",
      "explicit CI/CD deploy workflow",
    ],
  },
};

const result = {
  phase: "Phase368B",
  boundaryGenerated: true,
  localRuntimeCommandsClassified: true,
  productionDeployCommandPresent: false,
  buildIsDeploy: false,
  startIsDeploy: false,
  verifyIsDeploy: false,
  deployExecuted: false,
};

await writeText(
  "docs/phase368b-local-runtime-vs-production-deploy-boundary.md",
  [
    "# Phase368B Local Runtime vs Production Deploy Boundary",
    "",
    "- `pnpm start:pme` is local runtime activation, not production deploy.",
    "- `pnpm dev:phase7b` is local runtime activation, not production deploy.",
    "- `pnpm run build` is build only, not deploy.",
    "- `pnpm run verify:*` and `pnpm run smoke:*` are verification only, not deploy.",
    "- Production deploy requires an explicit deployment target and explicit deploy adapter/commandRef.",
  ].join("\n"),
);
await writeJson("docs/phase368b-command-classification.json", commandClassification);
await writeText(
  "docs/phase368b-local-runtime-activation-guide.md",
  [
    "# Phase368B Local Runtime Activation Guide",
    "",
    "Use local runtime activation only for local/internal runtime startup:",
    "",
    "- `pnpm start:pme`",
    "- `pnpm dev:phase7b`",
    "- `pnpm start:ai-gateway-service`",
    "- `pnpm start:agent-console`",
  ].join("\n"),
);
await writeText(
  "docs/phase368b-execution-report.md",
  [
    "# Phase368B Execution Report",
    "",
    "- local runtime and production deploy boundary generated",
    "- deployExecuted: false",
  ].join("\n"),
);
await writeJson(
  "apps/ai-gateway-service/evidence/phase368b/local-runtime-vs-production-deploy-boundary-result.json",
  result,
);

console.log(JSON.stringify(result, null, 2));
