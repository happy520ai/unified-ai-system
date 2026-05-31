import { confirmationPath, containsSecretLikeText, readJsonIfExists, writeJson, writeText } from "../phase365-common.mjs";

const confirmation = await readJsonIfExists(confirmationPath);
const validationErrors = [];

if (confirmation) {
  if (confirmation.confirmationType !== "final_manual_deploy_execution_confirmation") validationErrors.push("CONFIRMATION_TYPE_INVALID");
  if (confirmation.confirmationDecision !== "confirmed") validationErrors.push("CONFIRMATION_DECISION_NOT_CONFIRMED");
  if (confirmation.executeDeploy !== true) validationErrors.push("EXECUTE_DEPLOY_FALSE");
  if (!confirmation.confirmedBy) validationErrors.push("CONFIRMED_BY_MISSING");
  if (!confirmation.confirmedRole) validationErrors.push("CONFIRMED_ROLE_MISSING");
  if (!confirmation.confirmationTimestamp) validationErrors.push("CONFIRMATION_TIMESTAMP_MISSING");
  if (confirmation.safety?.codexIsConfirmer !== false) validationErrors.push("CODEX_IS_CONFIRMER");
  if (confirmation.safety?.secretValueIncluded !== false) validationErrors.push("SECRET_FLAG_TRUE");
  if (confirmation.safety?.apiKeyIncluded !== false) validationErrors.push("API_KEY_FLAG_TRUE");
  if (confirmation.safety?.approvalForged !== false) validationErrors.push("APPROVAL_FORGED_TRUE");
  if (!confirmation.approvedCommandRef) validationErrors.push("APPROVED_COMMAND_REF_MISSING");
  if (!Array.isArray(confirmation.approvedDeployScope) || confirmation.approvedDeployScope.length === 0) validationErrors.push("APPROVED_SCOPE_MISSING");
  for (const [key, value] of Object.entries(confirmation.acknowledgements || {})) {
    if (value !== true) validationErrors.push(`ACKNOWLEDGEMENT_FALSE:${key}`);
  }
  if (containsSecretLikeText(confirmation)) validationErrors.push("SECRET_VALUE_EXPOSED");
}

const result = {
  phase: "Phase365A",
  confirmationFilePresent: Boolean(confirmation),
  confirmationValid: Boolean(confirmation && validationErrors.length === 0),
  confirmationDecision: confirmation?.confirmationDecision || "missing",
  executeDeploy: confirmation?.executeDeploy === true,
  confirmedBy: confirmation?.confirmedBy || null,
  codexIsConfirmer: false,
  blocked: !confirmation || validationErrors.length > 0,
  blockReason: !confirmation || validationErrors.length > 0 ? "FINAL_MANUAL_DEPLOY_CONFIRMATION_MISSING_OR_INVALID" : null,
  safety: {
    secretValueExposed: false,
    apiKeyIncluded: false,
    approvalForged: false,
    deployExecuted: false,
  },
  validationErrors,
};

await writeJson("docs/phase365a-final-manual-deploy-confirmation.schema.json", {
  phase: "Phase365A",
  confirmationType: "final_manual_deploy_execution_confirmation",
  required: [
    "confirmationType",
    "confirmationId",
    "confirmedBy",
    "confirmedRole",
    "confirmedOrgRef",
    "confirmationDecision",
    "executeDeploy",
    "approvedCommandRef",
    "approvedDeployScope",
    "confirmationTimestamp",
    "conditions",
    "acknowledgements",
    "safety",
  ],
});
await writeText("docs/phase365a-final-manual-deploy-confirmation-intake-report.md", [
  "# Phase365A Final Manual Deploy Confirmation Intake Report",
  "",
  `- confirmationFilePresent: ${result.confirmationFilePresent}`,
  `- confirmationValid: ${result.confirmationValid}`,
  `- executeDeploy: ${result.executeDeploy}`,
  `- blocked: ${result.blocked}`,
].join("\n"));
await writeText("docs/phase365a-execution-report.md", [
  "# Phase365A Execution Report",
  "",
  "- intake executed",
  `- blocked: ${result.blocked}`,
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase365a/final-manual-deploy-confirmation-intake-result.json", result);

console.log(JSON.stringify(result, null, 2));
