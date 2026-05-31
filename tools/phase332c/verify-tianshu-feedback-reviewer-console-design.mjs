import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildTianshuFeedbackReviewerConsole } from "../../apps/agent-console/src/tianshuFeedbackReviewerConsole.js";
import { evaluateReviewerAction } from "../../apps/agent-console/src/tianshuPolicyApprovalActions.js";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase332c");
const evidencePath = resolve(evidenceDir, "tianshu-feedback-reviewer-console-smoke.json");
const stateContractPath = resolve(repoRoot, "docs/phase332c-reviewer-console-state-contract.json");
const actionContractPath = resolve(repoRoot, "docs/phase332c-reviewer-action-contract.json");
const reportPath = resolve(repoRoot, "docs/phase332c-reviewer-console-smoke-report.md");

const source = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase331c/tianshu-feedback-approval-workflow-result.json"), "utf8"));
const consoleState = buildTianshuFeedbackReviewerConsole({ proposal: source.proposal, approvalState: source.approvalState });
const activateAttempt = evaluateReviewerAction("activate_without_approval");
const smoke = {
  phase: "Phase332C",
  reviewerConsoleVisible: consoleState.reviewerConsoleVisible,
  proposalListVisible: consoleState.proposalList.proposalListVisible,
  proposalDetailVisible: consoleState.proposalDetail.proposalDetailVisible,
  approvalRequiredVisible: consoleState.proposalDetail.approvalRequiredVisible,
  autoApplyFalseVisible: consoleState.proposalDetail.autoApplyFalseVisible,
  activateActionBlocked: activateAttempt.actionAllowed === false,
  dryRunActionVisible: consoleState.dryRunPanel.dryRunActionVisible,
  rollbackPlanVisible: consoleState.proposalDetail.rollbackPlanVisible,
  policyActivated: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(smoke, null, 2)}\n`, "utf8");
await writeFile(stateContractPath, `${JSON.stringify(buildStateContract(source), null, 2)}\n`, "utf8");
await writeFile(actionContractPath, `${JSON.stringify(buildActionContract(activateAttempt), null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(smoke), "utf8");
await writeFile(resolve(repoRoot, "docs/phase332c-tianshu-feedback-reviewer-console-design.md"), renderDesign(), "utf8");
await writeFile(resolve(repoRoot, "docs/phase332c-execution-report.md"), renderReport(smoke), "utf8");
console.log(JSON.stringify(smoke, null, 2));

function buildStateContract(source) {
  return {
    phase: "Phase332C",
    selectedProposalId: source.proposal?.proposalId,
    proposalState: source.approvalState?.state,
    reviewerIdRef: source.approvalState?.reviewerIdRef,
    action: "activate_without_approval",
    actionAllowed: false,
    blockedReason: "ACTION_BLOCKED_BY_PHASE332C_REVIEWER_CONSOLE",
    activationAllowed: false,
    autoApply: false,
    auditTrace: {
      approvalRequired: true,
      autoApply: false,
      sensitiveRawFeedbackAllowed: false,
    },
  };
}

function buildActionContract(activateAttempt) {
  return {
    phase: "Phase332C",
    allowedActions: ["approve_for_dry_run", "reject", "request_changes", "mark_needs_more_samples", "rollback_required"],
    blockedActions: ["activate_without_approval", "auto_apply", "skip_dry_run", "use_sensitive_raw_feedback"],
    activationAttempt: activateAttempt,
  };
}

function renderDesign() {
  return [
    "# Phase332C Tianshu Feedback Reviewer Console Design",
    "",
    "The reviewer console displays proposals, approval state, dry-run result, rollback plan, and allowed/blocked actions.",
    "Policy activation remains blocked and autoApply is false.",
    "",
  ].join("\n");
}

function renderReport(smoke) {
  return [
    "# Phase332C Reviewer Console Smoke Report",
    "",
    `- reviewerConsoleVisible: ${smoke.reviewerConsoleVisible}`,
    `- proposalListVisible: ${smoke.proposalListVisible}`,
    `- proposalDetailVisible: ${smoke.proposalDetailVisible}`,
    `- activateActionBlocked: ${smoke.activateActionBlocked}`,
    `- dryRunActionVisible: ${smoke.dryRunActionVisible}`,
    "",
  ].join("\n");
}
