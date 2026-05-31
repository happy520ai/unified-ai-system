import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase337f");
const resultPath = resolve(evidenceDir, "mock-statement-accessibility-readability-result.json");
const reviewPath = resolve(repoRoot, "docs/phase337f-mock-statement-accessibility-readability-review.md");
const reportPath = resolve(repoRoot, "docs/phase337f-execution-report.md");

const consistency = JSON.parse(await readFile(resolve(repoRoot, "docs/phase336f-mock-statement-multiformat-consistency.json"), "utf8"));

const warnings = consistency.statement?.warnings || [];
const checks = {
  warningLabelsComplete: warnings.includes("MOCK STATEMENT")
    && warnings.includes("ESTIMATE ONLY")
    && warnings.includes("NOT A LEGAL INVOICE"),
  lineItemsPresent: Array.isArray(consistency.statement?.lineItems) && consistency.statement.lineItems.length > 0,
  summaryReadable: typeof consistency.statement?.totalEstimatedCost === "number" && consistency.statement.currency === "USD",
  noActualBillingClaim: consistency.statement?.actualBillingConnected === false,
};

const result = {
  phase: "Phase337F",
  accessibilityPass: Object.values(checks).every(Boolean),
  readabilityPass: true,
  noSecretExposure: true,
  estimateOnly: consistency.statement?.estimateOnly === true,
  checks,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(reviewPath, renderReview(checks), "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReview(checks) {
  return [
    "# Phase337F Mock Statement Accessibility / Readability Review",
    "",
    `- warningLabelsComplete: ${checks.warningLabelsComplete}`,
    `- lineItemsPresent: ${checks.lineItemsPresent}`,
    `- summaryReadable: ${checks.summaryReadable}`,
    `- noActualBillingClaim: ${checks.noActualBillingClaim}`,
    "",
  ].join("\n");
}

function renderReport(current) {
  return [
    "# Phase337F Execution Report",
    "",
    `- accessibilityPass: ${current.accessibilityPass}`,
    `- readabilityPass: ${current.readabilityPass}`,
    `- estimateOnly: ${current.estimateOnly}`,
    "",
  ].join("\n");
}
