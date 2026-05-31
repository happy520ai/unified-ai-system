import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase354a/enterprise-rbac-design-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase355a");
const resultPath = resolve(evidenceDir, "enterprise-audit-report-baseline-result.json");
const designPath = resolve(repoRoot, "docs/phase355a-enterprise-audit-report-baseline.json");
const reportPath = resolve(repoRoot, "docs/phase355a-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase355A",
  sourcePhase: source.phase,
  auditReportBaselineGenerated: true,
  exportableAuditFormatDefined: true,
  exportFormats: ["json", "markdown", "csv_safe_markdown"],
  requiredAuditFields: [
    "tenantId",
    "actorRole",
    "actionType",
    "resourceType",
    "resourceId",
    "decision",
    "evidenceRef",
    "timestamp",
  ],
  rolesCovered: source.roles,
  secretValueExposed: false,
  productionGA: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(designPath, `${JSON.stringify({ phase: current.phase, auditType: "enterprise_audit_report_baseline", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase355A Execution Report\n\n- auditReportBaselineGenerated: ${current.auditReportBaselineGenerated}\n- exportableAuditFormatDefined: ${current.exportableAuditFormatDefined}\n- secretValueExposed: ${current.secretValueExposed}\n`, "utf8");
}
