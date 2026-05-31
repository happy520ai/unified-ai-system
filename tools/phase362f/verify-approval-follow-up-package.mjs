import { readFile } from "node:fs/promises";

const jsonFiles = [
  "docs/phase362abcdef-prerequisite-check.json",
  "docs/phase362a-approval-evidence-intake.schema.json",
  "docs/phase362a-reviewer-follow-up-tracker.json",
  "apps/ai-gateway-service/evidence/phase362a/approval-evidence-intake-tracker-result.json",
  "docs/phase362b-deploy-authorization-remediation-checklist.json",
  "apps/ai-gateway-service/evidence/phase362b/deploy-authorization-remediation-result.json",
  "docs/phase362c-tenant-admin-signoff-checklist.json",
  "apps/ai-gateway-service/evidence/phase362c/tenant-admin-signoff-follow-up-result.json",
  "docs/phase362d-vault-approval-checklist.json",
  "apps/ai-gateway-service/evidence/phase362d/vault-approval-follow-up-result.json",
  "docs/phase362e-billing-warning-copy-checklist.json",
  "apps/ai-gateway-service/evidence/phase362e/billing-warning-copy-follow-up-result.json",
  "docs/phase362f-go-no-go-required-attendees.json",
  "docs/phase362f-go-no-go-pre-read-evidence-index.json",
  "docs/phase362f-go-no-go-scheduling-state.json",
  "apps/ai-gateway-service/evidence/phase362f/go-no-go-meeting-scheduling-packet-result.json",
];

const parsed = {};
for (const file of jsonFiles) parsed[file] = JSON.parse(await readFile(file, "utf8"));

assert(parsed["docs/phase362a-reviewer-follow-up-tracker.json"].items.length === 7, "tracker must cover seven approval types");
assert(parsed["docs/phase362a-reviewer-follow-up-tracker.json"].templateCountedAsApproval === false, "templates must not count as approvals");
assert(parsed["docs/phase362b-deploy-authorization-remediation-checklist.json"].deployAuthorized === false, "deployAuthorized must remain false");
assert(parsed["docs/phase362b-deploy-authorization-remediation-checklist.json"].safety.deployExecuted === false, "deploy must not execute");
assert(parsed["docs/phase362c-tenant-admin-signoff-checklist.json"].safety.approvalForged === false, "tenant approval must not be forged");
assert(parsed["docs/phase362d-vault-approval-checklist.json"].productionVaultEnabled === false, "production vault must remain disabled");
assert(parsed["docs/phase362e-billing-warning-copy-checklist.json"].realBillingConnected === false, "real billing must remain disconnected");
assert(parsed["docs/phase362f-go-no-go-scheduling-state.json"].goDecision === "pending", "goDecision must remain pending");
assert(parsed["docs/phase362f-go-no-go-scheduling-state.json"].goDecisionAllowed === false, "goDecisionAllowed must remain false");

console.log(JSON.stringify({ phase: "Phase362A-F", verified: true, jsonFileCount: jsonFiles.length }, null, 2));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
