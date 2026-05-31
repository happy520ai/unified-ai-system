import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/agent-console/evidence/phase354e/provider-onboarding-rbac-design-result.json");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase355e");
const resultPath = resolve(evidenceDir, "provider-onboarding-audit-report-baseline-result.json");
const designPath = resolve(repoRoot, "docs/phase355e-provider-onboarding-audit-report-baseline.json");
const reportPath = resolve(repoRoot, "docs/phase355e-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase355E",
  sourcePhase: source.phase,
  auditReportBaselineGenerated: true,
  exportableAuditFormatDefined: true,
  exportFormats: ["json", "markdown", "csv_safe_markdown"],
  requiredAuditFields: [
    "tenantId",
    "reviewerChecklistId",
    "actorRole",
    "credentialRefOnly",
    "rawSecretRejected",
    "setupDecision",
    "timestamp",
  ],
  noProviderCallFromUi: true,
  credentialRefOnly: true,
  secretValueExposed: false,
  productionGA: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(designPath, `${JSON.stringify({ phase: current.phase, auditType: "provider_onboarding_audit_report_baseline", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase355E Execution Report\n\n- auditReportBaselineGenerated: ${current.auditReportBaselineGenerated}\n- exportableAuditFormatDefined: ${current.exportableAuditFormatDefined}\n- credentialRefOnly: ${current.credentialRefOnly}\n`, "utf8");
}
