import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase341f");
const resultPath = resolve(evidenceDir, "mock-billing-beta-statement-visibility-policy-result.json");
const policyPath = resolve(repoRoot, "docs/phase341f-mock-billing-beta-visibility-policy.json");
const reportPath = resolve(repoRoot, "docs/phase341f-execution-report.md");

const readiness = JSON.parse(await readFile(resolve(repoRoot, "docs/phase340f-estimate-only-billing-readiness.json"), "utf8"));

const policy = {
  phase: "Phase341F",
  billingVisibilityPolicyDefined: true,
  estimateOnlyBillingReady: readiness.estimateOnlyBillingReady === true,
  actualBillingConnected: false,
  legalInvoiceGenerated: false,
  visibleTo: "internal_beta_reviewers_only",
  productionDefaultEnabled: false,
};

const result = {
  phase: "Phase341F",
  billingVisibilityPolicyDefined: true,
  actualBillingConnected: false,
  legalInvoiceGenerated: false,
  productionGA: false,
  secretValueExposed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(policyPath, `${JSON.stringify(policy, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReport(current) {
  return [
    "# Phase341F Execution Report",
    "",
    `- billingVisibilityPolicyDefined: ${current.billingVisibilityPolicyDefined}`,
    `- actualBillingConnected: ${current.actualBillingConnected}`,
    "",
  ].join("\n");
}
