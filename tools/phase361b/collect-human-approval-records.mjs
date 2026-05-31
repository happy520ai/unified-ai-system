import {
  approvalFiles,
  approvalSchema,
  collectApprovalRecords,
  markdownList,
  writeJson,
  writeText,
} from "../phase361-common.mjs";

const approvals = await collectApprovalRecords();
const recordsIndex = {
  phase: "Phase361B",
  indexName: "human-approval-records-index",
  approvalDirectory: "docs/approvals/phase361/",
  expectedRecords: Object.entries(approvalFiles).map(([approvalType, fileName]) => ({
    approvalType,
    recordRef: `docs/approvals/phase361/${fileName}`,
  })),
  collectedApprovals: approvals.collectedApprovals,
  missingApprovals: approvals.missingApprovals,
  invalidApprovals: approvals.invalidApprovals,
  conditionalApprovals: approvals.conditionalApprovals,
  approvalForged: false,
  secretValueExposed: false,
};

const result = {
  phase: "Phase361B",
  approvalSchemaGenerated: true,
  approvalRecordsIndexGenerated: true,
  collectedApprovalCount: approvals.collectedApprovals.length,
  missingApprovalCount: approvals.missingApprovals.length,
  invalidApprovalCount: approvals.invalidApprovals.length,
  collectedApprovals: approvals.collectedApprovals,
  missingApprovals: approvals.missingApprovals,
  invalidApprovals: approvals.invalidApprovals,
  approvalForged: false,
  secretValueExposed: false,
  workspaceCleanClaimed: false,
};

await writeJson("docs/phase361b-human-approval-record.schema.json", approvalSchema());
await writeJson("docs/phase361b-human-approval-records-index.json", recordsIndex);
await writeText("docs/phase361b-human-approval-collection-report.md", [
  "# Phase361B Human Approval Collection Report",
  "",
  `- collectedApprovalCount: ${result.collectedApprovalCount}`,
  `- missingApprovalCount: ${result.missingApprovalCount}`,
  `- invalidApprovalCount: ${result.invalidApprovalCount}`,
  "- approvalForged: false",
  "",
  "## Collected Approvals",
  markdownList(result.collectedApprovals),
].join("\n"));
await writeText("docs/phase361b-human-approval-missing-records.md", [
  "# Phase361B Human Approval Missing Records",
  "",
  markdownList(result.missingApprovals),
].join("\n"));
await writeText("docs/phase361b-execution-report.md", [
  "# Phase361B Execution Report",
  "",
  "- approvalSchemaGenerated: true",
  "- approvalRecordsIndexGenerated: true",
  `- collectedApprovalCount: ${result.collectedApprovalCount}`,
  `- missingApprovalCount: ${result.missingApprovalCount}`,
  `- invalidApprovalCount: ${result.invalidApprovalCount}`,
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase361b/human-approval-record-collection-result.json", result);

console.log(JSON.stringify(result, null, 2));
