import { readFile } from "node:fs/promises";

const jsonFiles = [
  "docs/phase361abcdef-prerequisite-check.json",
  "docs/phase361a-launch-authorization-workflow.schema.json",
  "docs/phase361a-launch-authorization-state.json",
  "apps/ai-gateway-service/evidence/phase361a/production-launch-authorization-workflow-result.json",
  "docs/phase361b-human-approval-record.schema.json",
  "docs/phase361b-human-approval-records-index.json",
  "apps/ai-gateway-service/evidence/phase361b/human-approval-record-collection-result.json",
  "docs/phase361c-deploy-authorization-state.json",
  "apps/ai-gateway-service/evidence/phase361c/deploy-authorization-packet-result.json",
  "docs/phase361d-signoff-verification-rules.json",
  "apps/ai-gateway-service/evidence/phase361d/tenant-admin-reviewer-signoff-verification-result.json",
  "docs/phase361e-release-runbook-checklist.json",
  "apps/ai-gateway-service/evidence/phase361e/production-release-runbook-finalization-result.json",
  "docs/phase361f-go-no-go-decision-state.json",
  "docs/phase361f-go-no-go-evidence-index.json",
  "apps/ai-gateway-service/evidence/phase361f/go-no-go-meeting-evidence-package-result.json",
];

const parsed = {};
for (const file of jsonFiles) {
  parsed[file] = JSON.parse(await readFile(file, "utf8"));
}

assert(parsed["docs/phase361a-launch-authorization-state.json"].launchAuthorized === false, "launchAuthorized must remain false without complete real approval chain");
assert(parsed["docs/phase361a-launch-authorization-state.json"].humanApprovalRequired === true, "humanApprovalRequired must be true");
assert(parsed["docs/phase361c-deploy-authorization-state.json"].safety.deployExecuted === false, "deploy must not be executed");
assert(parsed["docs/phase361c-deploy-authorization-state.json"].safety.releaseExecuted === false, "release must not be executed");
assert(parsed["docs/phase361c-deploy-authorization-state.json"].safety.tagCreated === false, "tag must not be created");
assert(parsed["docs/phase361e-release-runbook-checklist.json"].commandsMarkedRequiresAuthorization === true, "runbook commands must require authorization");
assert(parsed["docs/phase361f-go-no-go-decision-state.json"].goDecision !== "go", "goDecision must not be GO without complete real meeting evidence");
assert(parsed["docs/phase361f-go-no-go-decision-state.json"].safety.secretValueExposed === false, "secretValueExposed must be false");

console.log(JSON.stringify({ phase: "Phase361A-F", verified: true, jsonFileCount: jsonFiles.length }, null, 2));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
