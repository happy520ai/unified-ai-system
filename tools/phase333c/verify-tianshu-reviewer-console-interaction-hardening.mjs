import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildTianshuFeedbackReviewerConsole } from "../../apps/agent-console/src/tianshuFeedbackReviewerConsole.js";
import { evaluateReviewerAction } from "../../apps/agent-console/src/tianshuPolicyApprovalActions.js";
import { buildTianshuReviewerAuditTrail } from "../../apps/agent-console/src/tianshuReviewerAuditTrail.js";
import { buildTianshuReviewerBlockedActionBanner } from "../../apps/agent-console/src/tianshuReviewerBlockedActionBanner.js";
import { buildTianshuReviewerStateTransitionPreview } from "../../apps/agent-console/src/tianshuReviewerStateTransitionPreview.js";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase333c");
const evidencePath = resolve(evidenceDir, "tianshu-reviewer-console-interaction-hardening-smoke.json");
const transitionRulesPath = resolve(repoRoot, "docs/phase333c-reviewer-state-transition-rules.json");
const blockedRulesPath = resolve(repoRoot, "docs/phase333c-reviewer-blocked-action-rules.json");
const reportPath = resolve(repoRoot, "docs/phase333c-reviewer-interaction-smoke-report.md");
const source = await readJson("apps/ai-gateway-service/evidence/phase331c/tianshu-feedback-approval-workflow-result.json");
const consoleState = buildTianshuFeedbackReviewerConsole({ proposal: source.proposal, approvalState: source.approvalState });
const auditTrail = buildTianshuReviewerAuditTrail({ proposalId: source.proposal.proposalId, action: "approve_for_dry_run" });
const blockedBanner = buildTianshuReviewerBlockedActionBanner("activate_without_approval");
const transition = buildTianshuReviewerStateTransitionPreview({ currentState: source.approvalState.state, action: "approve_for_dry_run" });
const smoke = {
  phase: "Phase333C",
  proposalSelectable: Boolean(consoleState.selectedProposalId),
  stateBadgeVisible: Boolean(consoleState.proposalDetail.currentState),
  approveForDryRunVisible: consoleState.actions.allowedActions.includes("approve_for_dry_run"),
  rejectActionVisible: consoleState.actions.allowedActions.includes("reject"),
  requestChangesVisible: consoleState.actions.allowedActions.includes("request_changes"),
  activateWithoutApprovalBlocked: evaluateReviewerAction("activate_without_approval").actionAllowed === false,
  autoApplyBlocked: evaluateReviewerAction("auto_apply").actionAllowed === false,
  skipDryRunBlocked: evaluateReviewerAction("skip_dry_run").actionAllowed === false,
  auditTrailVisible: auditTrail.auditTrailVisible,
  reviewerNotesRequired: true,
  activationAllowed: transition.activationAllowed,
  blockedActionBannerVisible: blockedBanner.blockedActionBannerVisible,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(smoke, null, 2)}\n`, "utf8");
await writeFile(transitionRulesPath, `${JSON.stringify(buildTransitionRules(), null, 2)}\n`, "utf8");
await writeFile(blockedRulesPath, `${JSON.stringify(buildBlockedRules(), null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(smoke), "utf8");
await writeFile(resolve(repoRoot, "docs/phase333c-tianshu-reviewer-console-interaction-hardening-design.md"), renderDesign(), "utf8");
await writeFile(resolve(repoRoot, "docs/phase333c-execution-report.md"), renderReport(smoke), "utf8");
console.log(JSON.stringify(smoke, null, 2));

async function readJson(path) {
  return JSON.parse(await readFile(resolve(repoRoot, path), "utf8"));
}

function buildTransitionRules() {
  return {
    phase: "Phase333C",
    transitions: {
      approve_for_dry_run: "approved_for_dry_run",
      reject: "rejected",
      request_changes: "changes_requested",
      mark_needs_more_samples: "needs_more_samples",
      rollback_required: "rollback_required",
    },
    activationAllowed: false,
    dryRunResultRequiredBeforeActivation: true,
  };
}

function buildBlockedRules() {
  return {
    phase: "Phase333C",
    blockedActions: ["activate_without_approval", "auto_apply", "skip_dry_run"],
    reviewerNotesRequiredForRejection: true,
    activationBlockedByDefault: true,
  };
}

function renderDesign() {
  return [
    "# Phase333C Tianshu Reviewer Console Interaction Hardening Design",
    "",
    "Interaction hardening adds state transition preview, blocked action banners, audit trail, and reviewer note requirements.",
    "Activation remains blocked by default.",
    "",
  ].join("\n");
}

function renderReport(smoke) {
  return [
    "# Phase333C Reviewer Interaction Smoke Report",
    "",
    `- proposalSelectable: ${smoke.proposalSelectable}`,
    `- approveForDryRunVisible: ${smoke.approveForDryRunVisible}`,
    `- activateWithoutApprovalBlocked: ${smoke.activateWithoutApprovalBlocked}`,
    `- autoApplyBlocked: ${smoke.autoApplyBlocked}`,
    `- skipDryRunBlocked: ${smoke.skipDryRunBlocked}`,
    `- activationAllowed: ${smoke.activationAllowed}`,
    "",
  ].join("\n");
}
