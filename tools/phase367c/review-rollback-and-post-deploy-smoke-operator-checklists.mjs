import { readJson, writeJson, writeText } from "../phase367-common.mjs";

const rollbackTemplate = await readJson("docs/phase366d-rollback-execution-confirmation.template.json");
const smokeChecklist = await readJson("docs/phase366e-post-deploy-smoke-checklist.json");

const result = {
  phase: "Phase367C",
  rollbackOperatorChecklistReady:
    rollbackTemplate.templateOnly === true &&
    rollbackTemplate.executeRollback === false &&
    rollbackTemplate.codexIsConfirmer === false &&
    rollbackTemplate.requiresHumanCompletion === true,
  postDeploySmokeOperatorChecklistReady: Array.isArray(smokeChecklist.items) && smokeChecklist.items.length === 18,
  rollbackExecuted: false,
  postDeploySmokeExecuted: false,
  deployExecuted: false,
  secretValueExposed: false,
};

await writeText("docs/phase367c-rollback-operator-review.md", [
  "# Phase367C Rollback Operator Review",
  "",
  `- rollbackOperatorChecklistReady: ${result.rollbackOperatorChecklistReady}`,
].join("\n"));
await writeText("docs/phase367c-post-deploy-smoke-operator-review.md", [
  "# Phase367C Post-Deploy Smoke Operator Review",
  "",
  `- postDeploySmokeOperatorChecklistReady: ${result.postDeploySmokeOperatorChecklistReady}`,
].join("\n"));
await writeJson("docs/phase367c-operator-readiness-checklist.json", {
  phase: "Phase367C",
  rollbackReady: result.rollbackOperatorChecklistReady,
  smokeReady: result.postDeploySmokeOperatorChecklistReady,
});
await writeText("docs/phase367c-execution-report.md", [
  "# Phase367C Execution Report",
  "",
  `- rollbackOperatorChecklistReady: ${result.rollbackOperatorChecklistReady}`,
  `- postDeploySmokeOperatorChecklistReady: ${result.postDeploySmokeOperatorChecklistReady}`,
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase367c/rollback-post-deploy-smoke-operator-review-result.json", result);

console.log(JSON.stringify(result, null, 2));
