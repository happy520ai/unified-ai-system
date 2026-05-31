import { exists, readJsonIfExists, writeJson, writeText } from "../phase368-common.mjs";

const selectionTemplate = {
  templateOnly: true,
  notASelection: true,
  selectionType: "deployment_target_selection",
  selectedTarget: null,
  selectedPath: null,
  selectedBy: "",
  selectedRole: "",
  selectionTimestamp: null,
  conditions: [],
  codexMayGenerateExecutableCommandRef: false,
  codexIsSelector: false,
  safety: {
    secretValueIncluded: false,
    deployExecuted: false,
  },
};

const selectionFilePath = "docs/approvals/phase368/deployment-target-selection.json";
const selectionFilePresent = await exists(selectionFilePath);
const selectionFile = await readJsonIfExists(selectionFilePath);

const result = {
  phase: "Phase368E",
  selectionPacketGenerated: true,
  humanTargetSelectionPresent: selectionFilePresent,
  selectedTarget: selectionFile?.selectedTarget ?? null,
  codexMayGenerateExecutableCommandRef: false,
  requiresHumanTargetSelection: true,
  deployExecuted: false,
};

await writeText(
  "docs/phase368e-deployment-path-selection-packet.md",
  [
    "# Phase368E Deployment Path Selection Packet",
    "",
    "- Codex does not select the deployment target.",
    "- Human selection is required before any executable commandRef can be generated.",
    "- Candidate targets: local_runtime_activation_only, windows_service_deploy, docker_compose_deploy, vps_node_process_deploy, github_actions_cicd, internal_test_environment, release_artifact_only.",
  ].join("\n"),
);
await writeJson("docs/phase368e-deployment-path-selection-state.json", result);
await writeJson("docs/phase368e-human-target-selection.template.json", selectionTemplate);
await writeJson("docs/approvals/phase368/deployment-target-selection.json.template", selectionTemplate);
await writeText(
  "docs/phase368e-execution-report.md",
  [
    "# Phase368E Execution Report",
    "",
    `- humanTargetSelectionPresent: ${result.humanTargetSelectionPresent}`,
    "- deployExecuted: false",
  ].join("\n"),
);
await writeJson(
  "apps/ai-gateway-service/evidence/phase368e/deployment-path-selection-packet-result.json",
  result,
);

console.log(JSON.stringify(result, null, 2));
