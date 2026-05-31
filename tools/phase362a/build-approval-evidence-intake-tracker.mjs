import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  approvalMeta,
  intakeSchema,
  mdSection,
  phase362PrerequisiteCheck,
  repoRoot,
  templateFor,
  trackerItems,
  writeJson,
  writeText,
} from "../phase362-common.mjs";

await mkdir(resolve(repoRoot, "docs/approvals/phase362/templates"), { recursive: true });
const prereq = await phase362PrerequisiteCheck();
const { items, approvals } = await trackerItems();
for (const [approvalType, meta] of Object.entries(approvalMeta)) {
  await writeJson(`docs/approvals/phase362/templates/${meta.templateName}`, templateFor(approvalType));
}
await writeText("docs/approvals/phase362/README.md", [
  "# Phase362 Approval Intake",
  "",
  "This directory stores approval intake guidance and template-only records.",
  "",
  "- Files under `templates/` are not approvals.",
  "- `templateOnly=true` and `notAnApproval=true` records must never be counted as collected approvals.",
  "- Real approvals remain expected under `docs/approvals/phase361/` unless a later phase explicitly changes the intake path.",
].join("\n"));

const tracker = {
  phase: "Phase362A",
  trackerName: "reviewer-follow-up-tracker",
  statusEnum: ["missing", "requested", "received_pending_validation", "valid", "invalid", "blocked", "waived_by_authority", "not_required"],
  items,
  templateOnlyCount: Object.keys(approvalMeta).length,
  collectedApprovalCount: approvals.collectedApprovals.length,
  missingApprovalCount: approvals.missingApprovals.length,
  templateCountedAsApproval: false,
};
const result = {
  phase: "Phase362A",
  intakeSchemaGenerated: true,
  trackerGenerated: true,
  approvalTypesCovered: items.map((item) => item.approvalType),
  templateFilesGenerated: Object.values(approvalMeta).map((meta) => `docs/approvals/phase362/templates/${meta.templateName}`),
  templateOnlyCount: tracker.templateOnlyCount,
  collectedApprovalCount: tracker.collectedApprovalCount,
  missingApprovalCount: tracker.missingApprovalCount,
  templateCountedAsApproval: false,
  approvalForged: false,
  secretValueExposed: false,
  prerequisiteMissing: prereq.missing,
  workspaceCleanClaimed: false,
};

await writeJson("docs/phase362a-approval-evidence-intake.schema.json", intakeSchema());
await writeJson("docs/phase362a-reviewer-follow-up-tracker.json", tracker);
await writeText("docs/phase362a-approval-evidence-intake-design.md", [
  "# Phase362A Approval Evidence Intake Design",
  "",
  "Phase362A creates a template-only intake lane and a reviewer follow-up tracker. It does not approve launch, deploy, release, production GA, or Go/No-Go.",
  "",
  "- Real approval records are validated separately.",
  "- Templates are request aids only.",
  "- `waived_by_authority` is disallowed unless a real authority record exists in a later phase.",
].join("\n"));
await writeText("docs/phase362a-reviewer-follow-up-tracker.md", [
  "# Phase362A Reviewer Follow-up Tracker",
  "",
  mdSection("Tracker Items", items),
].join("\n"));
await writeText("docs/phase362a-approval-evidence-intake-report.md", [
  "# Phase362A Approval Evidence Intake Report",
  "",
  `- approvalTypesCovered: ${items.length}`,
  `- templateOnlyCount: ${tracker.templateOnlyCount}`,
  `- collectedApprovalCount: ${tracker.collectedApprovalCount}`,
  `- missingApprovalCount: ${tracker.missingApprovalCount}`,
  "- templateCountedAsApproval: false",
].join("\n"));
await writeText("docs/phase362a-execution-report.md", [
  "# Phase362A Execution Report",
  "",
  "- intakeSchemaGenerated: true",
  "- trackerGenerated: true",
  `- approvalTypesCovered: ${items.length}`,
  "- secretValueExposed: false",
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase362a/approval-evidence-intake-tracker-result.json", result);

console.log(JSON.stringify(result, null, 2));
