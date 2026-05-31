import { writeJson, writeText } from "../phase368-common.mjs";

const schema = {
  phase: "Phase365",
  commandRefId: "",
  deploymentTarget: "",
  preflightOnly: false,
  commandsExecutableInThisPhase: true,
  requiresFinalManualExecutionConfirmation: true,
  approvedCommands: [
    {
      command: "",
      purpose: "production_deploy",
      executableInPhase365: true,
      requiresDeployGateOpen: true,
      requiresFinalManualExecutionConfirmation: true,
      timeoutSeconds: 0,
      workingDirectory: "",
      expectedEvidenceRefs: [],
    },
  ],
  excludedCommands: [],
  safety: {
    secretValueIncluded: false,
    apiKeyIncluded: false,
    destructiveCleanupIncluded: false,
    gitResetHardIncluded: false,
    gitCleanIncluded: false,
    deployExecuted: false,
  },
};

const validationRules = {
  phase: "Phase368D",
  rejectedWhen: [
    "preflightOnly=true",
    "commandsExecutableInThisPhase=false",
    "approvedCommands is empty",
    "command contains git reset --hard",
    "command contains git clean",
    "command contains echo %...KEY...",
    "command contains cat .env / type .env / Get-Content .env",
    "command contains unapproved provider call",
    "command contains real billing / invoice",
    "command lacks requiresFinalManualExecutionConfirmation",
    "command lacks timeoutSeconds",
  ],
};

const result = {
  phase: "Phase368D",
  schemaGenerated: true,
  adapterDesignGenerated: true,
  validationRulesGenerated: true,
  executableCommandRefCreated: false,
  requiresHumanTargetSelection: true,
  deployExecuted: false,
};

await writeJson("docs/phase368d-executable-deploy-command-ref.schema.json", schema);
await writeText(
  "docs/phase368d-executable-deploy-command-ref-adapter-design.md",
  [
    "# Phase368D Executable Deploy Command Ref Adapter Design",
    "",
    "- This phase defines the shape of a future executable deploy commandRef.",
    "- It does not create a real executable commandRef yet.",
    "- A future commandRef must target one selected deployment path and remain gated by final manual execution confirmation.",
  ].join("\n"),
);
await writeJson("docs/phase368d-command-ref-validation-rules.json", validationRules);
await writeText(
  "docs/phase368d-execution-report.md",
  [
    "# Phase368D Execution Report",
    "",
    "- schema generated",
    "- executableCommandRefCreated: false",
  ].join("\n"),
);
await writeJson(
  "apps/ai-gateway-service/evidence/phase368d/deploy-command-ref-executable-adapter-design-result.json",
  result,
);

console.log(JSON.stringify(result, null, 2));
