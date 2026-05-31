import { writeJson, writeText } from "../phase366-common.mjs";

const template = {
  templateOnly: true,
  notAConfirmation: true,
  confirmationType: "rollback_execution_confirmation",
  confirmationDecision: "pending",
  executeRollback: false,
  rollbackReason: "",
  confirmedBy: "",
  confirmedRole: "",
  codexIsConfirmer: false,
  requiresHumanCompletion: true,
  safety: {
    secretValueIncluded: false,
    rollbackExecuted: false,
  },
};

const result = {
  phase: "Phase366D",
  rollbackTemplateGenerated: true,
  rollbackExecuted: false,
  codexIsConfirmer: false,
  secretValueExposed: false,
};

await writeJson("docs/phase366d-rollback-execution-confirmation.template.json", template);
await writeText("docs/phase366d-rollback-command-boundary.md", [
  "# Phase366D Rollback Command Boundary",
  "",
  "- This is a template only.",
  "- No rollback is executed in Phase366.",
].join("\n"));
await writeText("docs/phase366d-rollback-readiness-report.md", [
  "# Phase366D Rollback Readiness Report",
  "",
  "- rollbackTemplateGenerated: true",
  "- rollbackExecuted: false",
].join("\n"));
await writeText("docs/phase366d-execution-report.md", [
  "# Phase366D Execution Report",
  "",
  "- rollback template generated",
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase366d/rollback-execution-confirmation-template-result.json", result);

console.log(JSON.stringify(result, null, 2));
