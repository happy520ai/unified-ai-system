import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(
  repoRoot,
  "apps/ai-gateway-service/evidence/phase359f/billing-final-production-risk-gate-result.json",
);
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase360f");
const resultPath = resolve(evidenceDir, "billing-production-candidate-signoff-result.json");
const docPath = resolve(repoRoot, "docs/phase360f-billing-production-candidate-signoff.md");
const reportPath = resolve(repoRoot, "docs/phase360abcdef-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const blockers = Array.isArray(source.blockers) ? source.blockers : [];
const result = {
  phase: "Phase360F",
  sourcePhase: source.phase,
  signoffGenerated: true,
  deployAuthorized: false,
  releaseAuthorized: false,
  productionGaAuthorized: false,
  humanApprovalRequiredBeforeDeploy: true,
  blockerCount: blockers.length,
  blockers,
  paymentProviderConnected: false,
  realBillingConnected: false,
  legalInvoiceGenerated: false,
  quotaGateRequired: true,
  budgetGateRequired: true,
  unauthorizedProviderCalled: false,
  secretValueExposed: false,
  workspaceCleanClaimed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(
  docPath,
  [
    "# Phase360F Billing Production Candidate Signoff",
    "",
    "- signoffGenerated: true",
    "- deployAuthorized: false",
    "- releaseAuthorized: false",
    "- productionGaAuthorized: false",
    `- blockerCount: ${blockers.length}`,
    `- blockers: ${blockers.join(", ") || "none"}`,
    "- paymentProviderConnected: false",
    "- realBillingConnected: false",
    "- legalInvoiceGenerated: false",
  ].join("\n"),
  "utf8",
);
await writeFile(
  reportPath,
  [
    "# Phase360A-F Execution Report",
    "",
    "- productionCandidateOnly: true",
    "- deployAuthorized: false",
    "- releaseAuthorized: false",
    "- productionGaAuthorized: false",
    "- humanApprovalRequiredBeforeDeploy: true",
    "- realBillingConnected: false",
    "- legalInvoiceGenerated: false",
    "- workspaceCleanClaimed: false",
  ].join("\n"),
  "utf8",
);

console.log(JSON.stringify(result, null, 2));
