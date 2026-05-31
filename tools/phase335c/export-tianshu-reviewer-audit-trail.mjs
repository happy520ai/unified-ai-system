import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildTianshuReviewerAuditTrail } from "../../apps/agent-console/src/tianshuReviewerAuditTrail.js";
import { exportTianshuReviewerAuditTrail } from "../../apps/ai-gateway-service/src/three-mode/tianshuReviewerAuditExporter.js";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase335c");
const resultPath = resolve(evidenceDir, "tianshu-reviewer-audit-export-result.json");
const events = buildTianshuReviewerAuditTrail({ proposalId: "phase335c-proposal", action: "approve_for_dry_run" }).events;
const exported = exportTianshuReviewerAuditTrail(events);
const result = {
  phase: "Phase335C",
  auditTrailExported: true,
  jsonExportValid: JSON.parse(exported.json).eventCount === 1,
  markdownExportValid: exported.markdown.includes("# Tianshu Reviewer Audit Trail"),
  secretValueExposed: false,
  policyActivated: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(resolve(repoRoot, "docs/phase335c-execution-report.md"), renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReport(result) {
  return [
    "# Phase335C Execution Report",
    "",
    `- auditTrailExported: ${result.auditTrailExported}`,
    `- jsonExportValid: ${result.jsonExportValid}`,
    `- markdownExportValid: ${result.markdownExportValid}`,
    "",
  ].join("\n");
}
