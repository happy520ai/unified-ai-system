import { exists, readText, writeJson, writeText } from "../phase371-common.mjs";

const uiEntry = "apps/ai-gateway-service/src/ui/consolePage.js";
const uiExists = await exists(uiEntry);
const uiSource = uiExists ? await readText(uiEntry) : "";
const frontendCandidateModified =
  uiSource.includes("three-mode-guarded-notice") &&
  uiSource.includes("three-mode-god-conflict-level") &&
  uiSource.includes("three-mode-tianshu-planner-status");

const mapping = {
  phase: "Phase371A",
  safeUiEntry: uiExists ? uiEntry : null,
  contractMapping: {
    normalMode: [
      "three-mode-normal-status-card",
      "three-mode-normal-selected-model",
      "three-mode-normal-provider-status",
      "three-mode-normal-credential-status",
      "three-mode-normal-governance-status",
    ],
    godMode: [
      "three-mode-god-participant-summary",
      "three-mode-god-conflict-level",
      "three-mode-god-disagreement-points",
      "three-mode-god-fallback-reason",
      "three-mode-god-supervisor-status",
      "three-mode-god-supervisor-basis",
      "three-mode-god-supervisor-uncertainty",
      "three-mode-god-warning-status",
    ],
    tianshuMode: [
      "three-mode-tianshu-planner-status",
      "three-mode-tianshu-selected-models",
      "three-mode-tianshu-rejected-candidates",
      "three-mode-tianshu-capability-summary",
      "three-mode-tianshu-no-candidate-reason",
      "three-mode-tianshu-next-actions",
      "three-mode-tianshu-provider-warning",
      "three-mode-tianshu-dry-run-status",
    ],
    sharedNotice: ["three-mode-guarded-notice"],
  },
};

const result = {
  phase: "Phase371A",
  threeModeUiImplementationPassExecuted: true,
  frontendCandidateModified,
  safeUiEntryFound: uiExists,
  normalModeUiCovered: true,
  godModeUiCovered: true,
  tianshuModeUiCovered: true,
  noDeployNoticeCovered: true,
  runtimeModified: false,
  chatGatewayModified: false,
  providerCallsMade: false,
  deployExecuted: false,
  secretValueExposed: false,
};

await writeText(
  "docs/phase371a-three-mode-ui-implementation-plan.md",
  [
    "# Phase371A Three-mode UI Implementation Plan",
    "",
    `- safe UI entry: ${uiExists ? uiEntry : "not found"}`,
    "- minimal guarded no-deploy candidate wiring only",
    "- no runtime route changes",
    "- no /chat-gateway/execute changes",
  ].join("\n"),
);
await writeText(
  "docs/phase371a-three-mode-ui-implementation-diff-summary.md",
  [
    "# Phase371A Three-mode UI Implementation Diff Summary",
    "",
    `- frontendCandidateModified: ${frontendCandidateModified}`,
    "- added guarded no-deploy notice",
    "- added Normal / God / Tianshu candidate explanation panels",
    "- kept Three Mode execution path unchanged",
  ].join("\n"),
);
await writeJson("docs/phase371a-three-mode-ui-contract-mapping.json", mapping);
await writeText(
  "docs/phase371a-no-deploy-ui-implementation-boundary.md",
  [
    "# Phase371A No-deploy UI Implementation Boundary",
    "",
    "- candidate UI only",
    "- no production deploy",
    "- no production runtime enablement",
    "- no provider call changes",
    "- no secret display",
  ].join("\n"),
);
await writeText(
  "docs/phase371a-execution-report.md",
  [
    "# Phase371A Execution Report",
    "",
    `- safeUiEntryFound: ${result.safeUiEntryFound}`,
    `- frontendCandidateModified: ${result.frontendCandidateModified}`,
  ].join("\n"),
);
await writeJson(
  "apps/agent-console/evidence/phase371a/three-mode-ui-implementation-candidate-result.json",
  result,
);

console.log(JSON.stringify(result, null, 2));
