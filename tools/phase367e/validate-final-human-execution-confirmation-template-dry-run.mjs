import { containsSecretLikeText, readJson, writeJson, writeText } from "../phase367-common.mjs";

const template = await readJson("docs/phase366a-final-manual-deploy-confirmation.template.json");
const requiredFields = [
  "confirmationType",
  "confirmationId",
  "confirmedBy",
  "confirmedRole",
  "confirmationDecision",
  "executeDeploy",
  "approvedCommandRef",
  "approvedDeployScope",
  "confirmationTimestamp",
  "acknowledgements",
  "safety.codexIsConfirmer=false",
];

const valid =
  template.templateOnly === true &&
  template.notAConfirmation === true &&
  template.requiresHumanCompletion === true &&
  template.confirmationDecision === "pending" &&
  template.executeDeploy === false &&
  template.codexIsConfirmer === false &&
  !containsSecretLikeText(template);

const result = {
  phase: "Phase367E",
  templateValidationDryRunExecuted: true,
  templateValidForHumanCompletion: valid,
  realConfirmationGenerated: false,
  executeDeploy: false,
  deployExecuted: false,
  secretValueExposed: false,
};

await writeText("docs/phase367e-final-human-execution-confirmation-template-validation.md", [
  "# Phase367E Final Human Execution Confirmation Template Validation",
  "",
  `- templateValidForHumanCompletion: ${result.templateValidForHumanCompletion}`,
].join("\n"));
await writeJson("docs/phase367e-final-confirmation-required-fields.json", {
  phase: "Phase367E",
  requiredFields,
});
await writeText("docs/phase367e-final-confirmation-validation-dry-run-report.md", [
  "# Phase367E Final Confirmation Validation Dry-Run Report",
  "",
  `- templateValidForHumanCompletion: ${result.templateValidForHumanCompletion}`,
].join("\n"));
await writeText("docs/phase367e-execution-report.md", [
  "# Phase367E Execution Report",
  "",
  "- template validation dry-run executed",
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase367e/final-human-execution-confirmation-template-validation-result.json", result);

console.log(JSON.stringify(result, null, 2));
