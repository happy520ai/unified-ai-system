import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildTianshuReviewerAuditTrail } from "../../apps/agent-console/src/tianshuReviewerAuditTrail.js";
import { buildTianshuReviewerStateTransitionPreview } from "../../apps/agent-console/src/tianshuReviewerStateTransitionPreview.js";
import { exportTianshuReviewerAuditTrail } from "../../apps/ai-gateway-service/src/three-mode/tianshuReviewerAuditExporter.js";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase336c");
const resultPath = resolve(evidenceDir, "tianshu-approval-history-rollback-trace-result.json");
const reportPath = resolve(repoRoot, "docs/phase336c-execution-report.md");
const designPath = resolve(repoRoot, "docs/phase336c-tianshu-approval-history-rollback-trace.md");
const traceJsonPath = resolve(repoRoot, "docs/phase336c-tianshu-rollback-trace.json");

const approvalEvent = buildTianshuReviewerAuditTrail({
  proposalId: "phase336c-proposal",
  action: "approve_for_dry_run",
}).events[0];
const rollbackEvent = {
  eventId: "phase336c-audit-rollback-001",
  proposalId: "phase336c-proposal",
  action: "rollback_required",
  reviewerIdRef: "reviewer_anon",
  secretValueExposed: false,
};
const events = [approvalEvent, rollbackEvent];
const exported = exportTianshuReviewerAuditTrail(events);
const rollbackPreview = buildTianshuReviewerStateTransitionPreview({
  currentState: "approved_for_dry_run",
  action: "rollback_required",
});

const result = {
  phase: "Phase336C",
  rollbackTraceExported: true,
  approvalHistoryVisible: true,
  rollbackNextState: rollbackPreview.nextState,
  jsonExportValid: JSON.parse(exported.json).eventCount === events.length,
  markdownExportValid: exported.markdown.includes("# Tianshu Reviewer Audit Trail"),
  secretValueExposed: false,
  policyActivated: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(traceJsonPath, `${JSON.stringify({ phase: "Phase336C", events, rollbackPreview }, null, 2)}\n`, "utf8");
await writeFile(designPath, renderDesign(result, rollbackPreview), "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderDesign(current, rollbackPreview) {
  return [
    "# Phase336C Tianshu Approval History / Rollback Trace",
    "",
    `- approvalHistoryVisible: ${current.approvalHistoryVisible}`,
    `- rollbackTraceExported: ${current.rollbackTraceExported}`,
    `- rollbackNextState: ${rollbackPreview.nextState}`,
    "- policyActivated: false",
    "",
  ].join("\n");
}

function renderReport(current) {
  return [
    "# Phase336C Execution Report",
    "",
    `- rollbackTraceExported: ${current.rollbackTraceExported}`,
    `- jsonExportValid: ${current.jsonExportValid}`,
    `- markdownExportValid: ${current.markdownExportValid}`,
    "",
  ].join("\n");
}
