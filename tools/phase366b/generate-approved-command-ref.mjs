import { writeJson, writeText } from "../phase366-common.mjs";

const approvedCommandRef = {
  phase: "Phase366B",
  commandRefId: "approved-command-ref-phase366b-001",
  preflightOnly: true,
  commandsExecutableInThisPhase: false,
  requiresFinalManualExecutionConfirmation: true,
  approvedCommands: [
    {
      command: "pnpm run verify:phase107a-secret-safety",
      doNotExecuteInPhase366: true,
    },
    {
      command: "pnpm run verify:phase321a-workbench-product-recovery",
      doNotExecuteInPhase366: true,
    },
    {
      command: "pnpm -r --if-present check",
      doNotExecuteInPhase366: true,
    },
    {
      command: "pnpm run verify:phase322a-workbench-chat-gateway-real-nvidia",
      doNotExecuteInPhase366: true,
    },
    {
      command: "node tools/phase365d/execute-deploy-if-explicitly-confirmed.mjs --run",
      requiresFinalManualExecutionConfirmation: true,
      doNotExecuteInPhase366: true,
    },
  ],
  excludedCommands: [
    "git reset --hard",
    "git clean",
    "env dump",
    "direct .env read",
    "unapproved provider call",
    "real billing command",
    "invoice generation command",
  ],
  safety: {
    secretValueIncluded: false,
    apiKeyIncluded: false,
    destructiveCleanupIncluded: false,
    gitResetHardIncluded: false,
    gitCleanIncluded: false,
    deployExecuted: false,
  },
};

const result = {
  phase: "Phase366B",
  approvedCommandRefGenerated: true,
  commandRefId: approvedCommandRef.commandRefId,
  commandsExecutableInThisPhase: false,
  requiresFinalManualExecutionConfirmation: true,
  commandsExecuted: false,
  deployExecuted: false,
  secretValueIncluded: false,
  destructiveCleanupIncluded: false,
};

await writeJson("docs/phase366b-approved-command-ref.json", approvedCommandRef);
await writeText("docs/phase366b-approved-command-boundary.md", [
  "# Phase366B Approved Command Boundary",
  "",
  "DO NOT EXECUTE IN PHASE366",
  "REQUIRES FINAL MANUAL EXECUTION CONFIRMATION",
  "approvedCommandRef is a candidate reference only.",
].join("\n"));
await writeText("docs/phase366b-approved-command-review-report.md", [
  "# Phase366B Approved Command Review Report",
  "",
  `- commandRefId: ${approvedCommandRef.commandRefId}`,
  "- commandsExecutableInThisPhase: false",
].join("\n"));
await writeText("docs/phase366b-execution-report.md", [
  "# Phase366B Execution Report",
  "",
  "- approvedCommandRefGenerated: true",
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase366b/approved-command-ref-generation-result.json", result);

console.log(JSON.stringify(result, null, 2));
