import { readJson, writeJson, writeText } from "../phase366-common.mjs";

const phase365b = await readJson("docs/phase365b-deploy-command-final-safety-state.json");
const blockers = Array.isArray(phase365b.blockers) ? phase365b.blockers : [];

const template = {
  templateOnly: true,
  notAConfirmation: true,
  confirmationType: "final_manual_deploy_execution_confirmation",
  confirmationDecision: "pending",
  executeDeploy: false,
  codexIsConfirmer: false,
  requiresHumanCompletion: true,
};

const result = {
  phase: "Phase366A",
  remediationPackageGenerated: true,
  phase365BlockersDetected: blockers,
  finalConfirmationTemplateGenerated: true,
  realConfirmationGenerated: false,
  executeDeploy: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  secretValueExposed: false,
};

await writeJson("docs/phase366a-deploy-blocker-remediation-checklist.json", {
  phase: "Phase366A",
  blockers,
  remediationActions: [
    "prepare final manual deploy execution confirmation",
    "prepare approved commandRef",
    "re-verify deploy environment readiness",
  ],
});
await writeText("docs/phase366a-deploy-blocker-remediation-report.md", [
  "# Phase366A Deploy Blocker Remediation Report",
  "",
  `- phase365BlockersDetected: ${blockers.join(", ") || "none"}`,
  "- realConfirmationGenerated: false",
].join("\n"));
await writeText("docs/phase366a-final-confirmation-preparation-guide.md", [
  "# Phase366A Final Confirmation Preparation Guide",
  "",
  "- Fill the final confirmation only by a human confirmer.",
  "- Keep `executeDeploy=false` unless you explicitly want Phase365D to attempt deploy in a future rerun.",
  "- Do not treat this template as a real confirmation.",
].join("\n"));
await writeJson("docs/phase366a-final-manual-deploy-confirmation.template.json", template);
await writeText("docs/phase366a-execution-report.md", [
  "# Phase366A Execution Report",
  "",
  "- remediationPackageGenerated: true",
  "- finalConfirmationTemplateGenerated: true",
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase366a/deploy-blocker-remediation-result.json", result);

console.log(JSON.stringify(result, null, 2));
