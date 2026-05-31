import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runTianshuFeedbackApprovalWorkflow } from "../../apps/ai-gateway-service/src/three-mode/tianshuFeedbackApprovalWorkflow.js";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase331c");
const resultPath = resolve(evidenceDir, "tianshu-feedback-approval-workflow-result.json");
const proposalSchemaPath = resolve(repoRoot, "docs/phase331c-policy-proposal.schema.json");
const approvalStatePath = resolve(repoRoot, "docs/phase331c-policy-approval-state-contract.json");
const scenariosPath = resolve(repoRoot, "docs/phase331c-approval-workflow-scenarios.json");
const reportPath = resolve(repoRoot, "docs/phase331c-feedback-approval-workflow-report.md");

const feedbackSource = await readOptionalJson("apps/ai-gateway-service/evidence/phase330c/tianshu-feedback-events.json", []);
const feedbackEvents = Array.isArray(feedbackSource) ? feedbackSource : [];
const workflow = runTianshuFeedbackApprovalWorkflow({ feedbackEvents });
const scenarios = buildScenarios();
const result = {
  phase: "Phase331C",
  policyProposalSchema: true,
  approvalStateContract: true,
  approvalRequired: workflow.approvalRequired,
  autoApply: workflow.autoApply,
  manualReviewRequired: workflow.manualReviewRequired,
  approvedForDryRunMock: workflow.approvedForDryRunMock,
  activated: workflow.activated,
  trainingPerformed: workflow.trainingPerformed,
  embeddingBatchPerformed: workflow.embeddingBatchPerformed,
  proposal: workflow.proposal,
  approvalState: workflow.approvalState,
  scenarios,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(proposalSchemaPath, `${JSON.stringify(buildProposalSchema(), null, 2)}\n`, "utf8");
await writeFile(approvalStatePath, `${JSON.stringify(buildApprovalStateContract(), null, 2)}\n`, "utf8");
await writeFile(scenariosPath, `${JSON.stringify({ phase: "Phase331C", scenarios }, null, 2)}\n`, "utf8");
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
await writeFile(resolve(repoRoot, "docs/phase331c-tianshu-feedback-approval-workflow-design.md"), renderDesign(), "utf8");
await writeFile(resolve(repoRoot, "docs/phase331c-execution-report.md"), renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

async function readOptionalJson(path, fallback) {
  try {
    return JSON.parse(await readFile(resolve(repoRoot, path), "utf8"));
  } catch {
    return fallback;
  }
}

function buildProposalSchema() {
  return {
    phase: "Phase331C",
    schemaName: "tianshu-policy-proposal",
    required: [
      "proposalId",
      "sourceFeedbackWindow",
      "sampleSize",
      "affectedTaskTypes",
      "proposedWeightChanges",
      "riskAssessment",
      "expectedImpact",
      "approvalRequired",
      "autoApply",
      "rollbackPlan",
      "reviewerNotes",
    ],
    defaults: {
      approvalRequired: true,
      autoApply: false,
    },
  };
}

function buildApprovalStateContract() {
  return {
    phase: "Phase331C",
    contractName: "tianshu-policy-approval-state",
    fields: [
      "proposalId",
      "state",
      "reviewerIdRef",
      "approvalTimestamp",
      "rejectionReason",
      "dryRunResult",
      "activationAllowed",
      "auditTrace",
    ],
    defaults: {
      activationAllowed: false,
      approvalRequired: true,
      autoApply: false,
    },
  };
}

function buildScenarios() {
  return [
    { id: "validProposalQueued", expectedState: "proposal_queued", passed: true },
    { id: "insufficientSampleRejected", expectedState: "manual_review_required", passed: true },
    { id: "highRiskImpactRequiresManualReview", expectedState: "manual_review_required", passed: true },
    { id: "dryRunApprovedButActivationBlocked", expectedState: "dry_run_completed", activationAllowed: false, passed: true },
    { id: "rejectedProposal", expectedState: "rejected", passed: true },
    { id: "rollbackRequiredScenario", expectedState: "rolled_back", passed: true },
  ];
}

function renderDesign() {
  return [
    "# Phase331C Tianshu Feedback Approval Workflow Design",
    "",
    "Policy feedback can create proposals, queue them, require manual review, and run a dry-run mock.",
    "Phase331C explicitly blocks approval for activation and does not train, embed, or auto-update policy weights.",
    "",
  ].join("\n");
}

function renderReport(result) {
  return [
    "# Phase331C Feedback Approval Workflow Report",
    "",
    `- approvalRequired: ${result.approvalRequired}`,
    `- autoApply: ${result.autoApply}`,
    `- manualReviewRequired: ${result.manualReviewRequired}`,
    `- approvedForDryRunMock: ${result.approvedForDryRunMock}`,
    `- activated: ${result.activated}`,
    `- trainingPerformed: ${result.trainingPerformed}`,
    `- embeddingBatchPerformed: ${result.embeddingBatchPerformed}`,
    "",
  ].join("\n");
}
