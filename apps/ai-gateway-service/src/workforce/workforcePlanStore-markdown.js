import {
  WORKFORCE_PLAN_PRODUCT_TEMPLATE_PACK_PHASE,
  WORKFORCE_PLAN_ROLE_TIER_EVENT_LEDGER_PHASE,
  WORKFORCE_PLAN_EXECUTION_READINESS_PREFLIGHT_PHASE,
  WORKFORCE_PLAN_EXTERNAL_OMX_RUNNER_DESIGN_PHASE,
  WORKFORCE_PLAN_RUNNER_REQUEST_QUEUE_PHASE,
  WORKFORCE_PLAN_EXECUTION_APPROVAL_RECORD_PHASE,
  WORKFORCE_PLAN_EXTERNAL_RUNNER_PROTOCOL_FREEZE_PHASE,
  WORKFORCE_PLAN_FINAL_UX_SEAL_PHASE,
  WORKFORCE_PLAN_HANDOFF_PACKAGE_MANIFEST_PHASE,
  WORKFORCE_PLAN_CODEX_DESKTOP_HANDOFF_PACK_PHASE,
  WORKFORCE_PLAN_MANUAL_CODEX_EXECUTION_LOOP_PHASE,
  WORKFORCE_PLAN_CODEX_RESULT_REVIEW_PHASE,
  WORKFORCE_PLAN_SAFE_DESKTOP_RUNNER_DESIGN_PHASE,
  WORKFORCE_PLAN_REVIEW_APPROVAL_PHASE,
} from "./workforcePlanStore-constants.js";

export function formatTaskPackageMarkdown({ plan, planId, savedAt }) {
  const lines = [
    "# Agent Workforce Task Package",
    "",
    "- Plan ID: " + planId,
    "- Workforce ID: " + (plan.workforceId || "n/a"),
    "- Plan version: " + (plan.planVersion || "n/a"),
    "- Created at: " + (plan.createdAt || "n/a"),
    "- Saved at: " + savedAt,
    "- Goal: " + plan.goal,
    "- Selected template: " + (plan.selectedTemplate?.name || plan.templateContext?.selectedTemplateName || "n/a"),
    "",
    "## Product Templates Preview",
    "- Phase: " + (plan.productTemplatesPreview?.phase || WORKFORCE_PLAN_PRODUCT_TEMPLATE_PACK_PHASE),
    "- Mode: " + (plan.productTemplatesPreview?.mode || "product-template-pack-preview"),
    "- Template pack enabled: " + (plan.productTemplatesPreview?.templatePackEnabled !== false),
    "- Execution enabled: " + Boolean(plan.productTemplatesPreview?.executionEnabled),
    "- Selected template: " + (plan.productTemplatesPreview?.selectedTemplateId || plan.selectedTemplate?.id || "n/a"),
  ]
    .concat((plan.productTemplatesPreview?.templates || []).map((item) => "- Template: " + item.name + " (" + item.id + ") - " + item.description + "; execution=" + item.execution))
    .concat((plan.productTemplatesPreview?.templates || []).flatMap((item) => [
      "- Sample goal for " + item.id + ": " + (item.sampleGoal || "n/a"),
      ...((item.expectedPlanSections || []).map((section) => "  - Expected section: " + section)),
      ...((item.sampleAcceptanceChecklist || []).map((check) => "  - Sample acceptance: " + check)),
    ]))
    .concat((plan.productTemplatesPreview?.demoGoals || []).map((item) => "- Demo goal: " + item.templateName + " - " + item.sampleGoal + "; execution=" + item.execution))
    .concat((plan.productTemplatesPreview?.blockedReasons || []).map((item) => "- Blocker: " + item))
    .concat([
      "",
      "## Template Context",
      "- Phase: " + (plan.templateContext?.phase || WORKFORCE_PLAN_PRODUCT_TEMPLATE_PACK_PHASE),
      "- Selected template: " + (plan.templateContext?.selectedTemplateName || plan.selectedTemplate?.name || "n/a"),
      "- Execution enabled: " + Boolean(plan.templateContext?.executionEnabled),
      "- External runner dispatch enabled: " + Boolean(plan.templateContext?.externalRunnerDispatchEnabled),
      "- Workflow run enabled: " + Boolean(plan.templateContext?.workflowRunEnabled),
    ])
    .concat((plan.templateContext?.focusAreas || []).map((item) => "- Focus area: " + item))
    .concat((plan.templateContext?.expectedOutputs || []).map((item) => "- Expected output: " + item))
    .concat((plan.templateContext?.expectedPlanSections || []).map((item) => "- Expected plan section: " + item))
    .concat((plan.templateContext?.sampleAcceptanceChecklist || []).map((item) => "- Sample acceptance: " + item))
    .concat([
      "",
    "## Summary",
    plan.summary || "",
    "",
    "## Roles",
  ])
    .concat((plan.roleAssignments || []).map((item) => "- " + item.role + ": " + item.responsibility))
    .concat([
      "",
      "## Role Tiers",
    ])
    .concat((plan.roleTiers || []).flatMap((tier) => [
      "- " + tier.name + ": " + tier.purpose,
      ...(tier.roles || []).map((role) => "  - " + role.role + ": " + role.responsibility),
    ]))
    .concat([
      "",
      "## Clarification Questions",
  ])
  .concat((plan.clarifyQuestions || []).map((item) => "- " + item.topic + ": " + item.question))
    .concat([
      "",
      "## Clarification Answers",
    ])
    .concat((plan.clarificationAnswers || []).map((item) => "- " + item.questionId + ": " + item.answer))
    .concat([
      "",
      "## Answered Clarifications",
    ])
    .concat((plan.answeredClarifications || []).map((item) => "- " + item.questionId + ": " + item.answer))
    .concat([
      "",
      "## Unresolved Clarifications",
    ])
    .concat((plan.unresolvedClarifications || []).map((item) => "- " + item.questionId + ": " + item.question))
    .concat([
      "",
      "## Consensus Preview",
    ])
    .concat((plan.consensusPreview || []).map((item) => "- " + item.role + ": " + item.recommendation))
    .concat([
      "",
      "## Hook Events Preview",
    ])
    .concat((plan.hookEventsPreview || []).map((item) => "- " + item.event + ": enabled=" + item.enabled))
    .concat([
      "",
      "## Event Ledger Preview",
    ])
    .concat((plan.eventLedgerPreview || []).map((item) => "- " + item.eventName + ": enabled=" + item.enabled + "; execution=" + item.execution + "; " + item.payloadSummary))
    .concat([
      "",
      "## Agent Workforce HUD Preview",
      "- Phase: " + (plan.workforceHudPreview?.phase || WORKFORCE_PLAN_ROLE_TIER_EVENT_LEDGER_PHASE),
      "- Plan State: " + (plan.workforceHudPreview?.planState || "n/a"),
      "- Clarification: " + (plan.workforceHudPreview?.clarification?.answered ?? 0) + "/" + (plan.workforceHudPreview?.clarification?.total ?? 0),
      "- Consensus: " + (plan.workforceHudPreview?.consensus?.ready ? "ready" : "needs review"),
      "- Review Package: " + (plan.workforceHudPreview?.reviewPackage?.status || "n/a"),
      "- Approval Gate: " + (plan.workforceHudPreview?.approvalGate?.status || "waiting-human-review"),
      "- Workflow Handoff: " + (plan.workforceHudPreview?.workflowHandoff?.status || "disabled"),
      "- OMX Handoff: " + (plan.workforceHudPreview?.omxHandoff?.status || "preview-only"),
      "- Execution: " + (plan.workforceHudPreview?.execution?.status || "disabled"),
      "- Execution readiness: " + (plan.workforceHudPreview?.execution?.readiness || "blocked"),
      "",
      "## OMX Handoff Preview",
      "- Phase: " + (plan.omxHandoffPreview?.phase || "phase-142a-workforce-omx-handoff-preview"),
      "- Mode: " + (plan.omxHandoffPreview?.mode || "omx-compatible-preview"),
      "- Status: " + (plan.omxHandoffPreview?.status || "handoff-preview-ready"),
      "- Recommended workflow: " + (plan.omxHandoffPreview?.recommendedWorkflow || "deep-interview -> ralplan -> team/ralph"),
      "- Execution enabled: " + Boolean(plan.omxHandoffPreview?.executionEnabled),
      "- Runs oh-my-codex: " + Boolean(plan.omxHandoffPreview?.runsOhMyCodex),
      "- Creates worktrees: " + Boolean(plan.omxHandoffPreview?.createsWorktrees),
      "",
      "## Execution Readiness Preflight",
      "- Phase: " + (plan.executionReadinessPreflight?.phase || WORKFORCE_PLAN_EXECUTION_READINESS_PREFLIGHT_PHASE),
      "- Mode: " + (plan.executionReadinessPreflight?.mode || "preview-only"),
      "- Overall status: " + (plan.executionReadinessPreflight?.overallStatus || "blocked"),
      "- Execution enabled: " + Boolean(plan.executionReadinessPreflight?.executionEnabled),
    ])
    .concat((plan.executionReadinessPreflight?.checks || []).map((item) => "- " + item.name + ": " + item.status + "; required=" + item.required + "; " + item.reason))
    .concat((plan.executionReadinessPreflight?.blockedReasons || []).map((item) => "- Blocker: " + item))
    .concat([
      "- Recommended next step: " + (plan.executionReadinessPreflight?.recommendedNextStep || "Design external runner protocol before enabling execution"),
      "",
      "## External OMX Runner Design",
      "- Phase: " + (plan.externalOmxRunnerDesign?.phase || WORKFORCE_PLAN_EXTERNAL_OMX_RUNNER_DESIGN_PHASE),
      "- Mode: " + (plan.externalOmxRunnerDesign?.mode || "external-runner-design"),
      "- Runner enabled: " + Boolean(plan.externalOmxRunnerDesign?.runnerEnabled),
      "- Execution enabled: " + Boolean(plan.externalOmxRunnerDesign?.executionEnabled),
      "- Design only: " + (plan.externalOmxRunnerDesign?.designOnly !== false),
    ])
    .concat((plan.externalOmxRunnerDesign?.proposedEndpoints || []).map((item) => "- Proposed endpoint: " + item.method + " " + item.path + "; execution=" + item.execution + "; " + item.purpose))
    .concat((plan.externalOmxRunnerDesign?.requiredPreflightChecks || []).map((item) => "- Required preflight check: " + item))
    .concat((plan.externalOmxRunnerDesign?.blockedReasons || []).map((item) => "- Blocker: " + item))
    .concat([
      "",
      "## Runner Request Review Queue Preview",
      "- Phase: " + (plan.runnerRequestQueuePreview?.phase || WORKFORCE_PLAN_RUNNER_REQUEST_QUEUE_PHASE),
      "- Mode: " + (plan.runnerRequestQueuePreview?.mode || "review-queue-preview"),
      "- Queue enabled: " + Boolean(plan.runnerRequestQueuePreview?.queueEnabled),
      "- Execution enabled: " + Boolean(plan.runnerRequestQueuePreview?.executionEnabled),
      "- Request state: " + (plan.runnerRequestQueuePreview?.requestState || "draft-review-only"),
      "- Auto dispatch enabled: " + Boolean(plan.runnerRequestQueuePreview?.queuePolicy?.autoDispatchEnabled),
      "- External runner dispatch enabled: " + Boolean(plan.runnerRequestQueuePreview?.queuePolicy?.externalRunnerDispatchEnabled),
      "- Approval preview is execution permission: " + Boolean(plan.runnerRequestQueuePreview?.queuePolicy?.approvalPreviewIsExecutionPermission),
    ])
    .concat((plan.runnerRequestQueuePreview?.blockedReasons || []).map((item) => "- Blocker: " + item))
    .concat([
      "- Recommended next step: " + (plan.runnerRequestQueuePreview?.recommendedNextStep || "Record approval decision preview before any future runner request can be considered"),
      "",
      "## Execution Request Approval Record Preview",
      "- Phase: " + (plan.executionApprovalRecordPreview?.phase || WORKFORCE_PLAN_EXECUTION_APPROVAL_RECORD_PHASE),
      "- Mode: " + (plan.executionApprovalRecordPreview?.mode || "approval-record-preview"),
      "- Approval record enabled: " + Boolean(plan.executionApprovalRecordPreview?.approvalRecordEnabled),
      "- Execution enabled: " + Boolean(plan.executionApprovalRecordPreview?.executionEnabled),
      "- Approval state: " + (plan.executionApprovalRecordPreview?.approvalState || "not-approved-for-execution"),
      "- Approval preview is execution permission: " + Boolean(plan.executionApprovalRecordPreview?.approvalPolicy?.approvalPreviewIsExecutionPermission),
    ])
    .concat((plan.executionApprovalRecordPreview?.recordFieldsPreview || []).map((item) => "- Record field preview: " + item))
    .concat((plan.executionApprovalRecordPreview?.blockedReasons || []).map((item) => "- Blocker: " + item))
    .concat([
      "- Recommended next step: " + (plan.executionApprovalRecordPreview?.recommendedNextStep || "Freeze external runner protocol before implementing any real runner"),
      "",
      "## External Runner Protocol Freeze",
      "- Phase: " + (plan.externalRunnerProtocolFreeze?.phase || WORKFORCE_PLAN_EXTERNAL_RUNNER_PROTOCOL_FREEZE_PHASE),
      "- Mode: " + (plan.externalRunnerProtocolFreeze?.mode || "protocol-freeze"),
      "- Protocol version: " + (plan.externalRunnerProtocolFreeze?.protocolVersion || "preview-1"),
      "- Frozen: " + (plan.externalRunnerProtocolFreeze?.frozen !== false),
      "- Runner enabled: " + Boolean(plan.externalRunnerProtocolFreeze?.runnerEnabled),
      "- Execution enabled: " + Boolean(plan.externalRunnerProtocolFreeze?.executionEnabled),
      "- Design only: " + (plan.externalRunnerProtocolFreeze?.designOnly !== false),
    ])
    .concat((plan.externalRunnerProtocolFreeze?.coveredCapabilities || []).map((item) => "- Covered capability: " + item))
    .concat((plan.externalRunnerProtocolFreeze?.frozenInvariants || []).map((item) => "- Frozen invariant: " + item))
    .concat((plan.externalRunnerProtocolFreeze?.requiredBeforeRealExecution || []).map((item) => "- Required before real execution: " + item))
    .concat((plan.externalRunnerProtocolFreeze?.blockedReasons || []).map((item) => "- Blocker: " + item))
    .concat([
      "",
      "## Agent Workforce Preview Final UX Seal",
      "- Phase: " + (plan.agentWorkforcePreviewFinalUxSeal?.phase || WORKFORCE_PLAN_FINAL_UX_SEAL_PHASE),
      "- Mode: " + (plan.agentWorkforcePreviewFinalUxSeal?.mode || "preview-final-ux-seal"),
      "- Sealed: " + (plan.agentWorkforcePreviewFinalUxSeal?.sealed !== false),
      "- Preview only: " + (plan.agentWorkforcePreviewFinalUxSeal?.previewOnly !== false),
      "- Execution enabled: " + Boolean(plan.agentWorkforcePreviewFinalUxSeal?.executionEnabled),
      "- Runner enabled: " + Boolean(plan.agentWorkforcePreviewFinalUxSeal?.runnerEnabled),
      "- Workflow run enabled: " + Boolean(plan.agentWorkforcePreviewFinalUxSeal?.workflowRunEnabled),
      "- External runner dispatch enabled: " + Boolean(plan.agentWorkforcePreviewFinalUxSeal?.externalRunnerDispatchEnabled),
      "- OMX execution enabled: " + Boolean(plan.agentWorkforcePreviewFinalUxSeal?.omxExecutionEnabled),
    ])
    .concat((plan.agentWorkforcePreviewFinalUxSeal?.userPath || []).map((item) => "- User path: " + item))
    .concat((plan.agentWorkforcePreviewFinalUxSeal?.finalUiMessages || []).map((item) => "- Final UX message: " + item))
    .concat((plan.agentWorkforcePreviewFinalUxSeal?.blockedReasons || []).map((item) => "- Blocker: " + item))
    .concat([
      "- Recommended next step: " + (plan.agentWorkforcePreviewFinalUxSeal?.recommendedNextStep || "Keep Agent Workforce as a productized preview console until a later explicit real-execution mainline is approved."),
      "",
      "## Export / Handoff Explanation",
      "- Export is a handoff package for human review, not an execution package.",
      "- Suggested OMX commands are text only and are not executed.",
      "- approval-preview is not execution approval.",
      "- executionEnabled=false is preserved in the export.",
      "",
      "## Handoff Package Manifest",
      "- Phase: " + (plan.handoffPackageManifest?.phase || WORKFORCE_PLAN_HANDOFF_PACKAGE_MANIFEST_PHASE),
      "- Mode: " + (plan.handoffPackageManifest?.mode || "handoff-package-manifest-preview"),
      "- Manifest enabled: " + (plan.handoffPackageManifest?.manifestEnabled !== false),
      "- Execution enabled: " + Boolean(plan.handoffPackageManifest?.executionEnabled),
      "- Runner enabled: " + Boolean(plan.handoffPackageManifest?.runnerEnabled),
      "- Workflow run enabled: " + Boolean(plan.handoffPackageManifest?.workflowRunEnabled),
      "- Package purpose: " + (plan.handoffPackageManifest?.packagePurpose || "Human-readable Agent Workforce preview handoff package; not execution."),
    ])
    .concat((plan.handoffPackageManifest?.includedSections || []).map((item) => "- Included section: " + item))
    .concat((plan.handoffPackageManifest?.externalRunnerDisabledReasons || []).map((item) => "- External runner disabled reason: " + item))
    .concat((plan.handoffPackageManifest?.blockedReasons || []).map((item) => "- Blocker: " + item))
    .concat([
      "",
      "## Codex Desktop Handoff Pack",
      "- Phase: " + (plan.codexDesktopHandoffPack?.phase || WORKFORCE_PLAN_CODEX_DESKTOP_HANDOFF_PACK_PHASE),
      "- Mode: " + (plan.codexDesktopHandoffPack?.mode || "codex-desktop-handoff-preview"),
      "- Manual copy/paste only: " + (plan.codexDesktopHandoffPack?.manualOnly !== false),
      "- Codex execution enabled in web system: " + Boolean(plan.codexDesktopHandoffPack?.codexExecutionEnabled),
      "- Auto dispatch enabled: " + Boolean(plan.codexDesktopHandoffPack?.autoDispatchEnabled),
      "- Target: " + (plan.codexDesktopHandoffPack?.target || "desktop-codex-or-codex-cli"),
      "- Copy/paste required: " + (plan.codexDesktopHandoffPack?.copyPasteRequired !== false),
      "- Task goal: " + (plan.codexDesktopHandoffPack?.taskGoal || plan.goal || "n/a"),
    ])
    .concat((plan.codexDesktopHandoffPack?.contextSummary || []).map((item) => "- Context: " + item))
    .concat((plan.codexDesktopHandoffPack?.allowedFiles || []).map((item) => "- Allowed file: " + item))
    .concat((plan.codexDesktopHandoffPack?.forbiddenActions || []).map((item) => "- Forbidden action: " + item))
    .concat((plan.codexDesktopHandoffPack?.implementationConstraints || []).map((item) => "- Implementation constraint: " + item))
    .concat((plan.codexDesktopHandoffPack?.verificationCommands || []).map((item) => "- Verification command: " + item))
    .concat((plan.codexDesktopHandoffPack?.evidenceExpectations || []).map((item) => "- Evidence expectation: " + item))
    .concat((plan.codexDesktopHandoffPack?.responseFormat || []).map((item) => "- Response format: " + item))
    .concat((plan.codexDesktopHandoffPack?.blockedReasons || []).map((item) => "- Blocker: " + item))
    .concat([
      "",
      "## Manual Codex Execution Loop",
      "- Phase: " + (plan.manualCodexExecutionLoop?.phase || WORKFORCE_PLAN_MANUAL_CODEX_EXECUTION_LOOP_PHASE),
      "- Mode: " + (plan.manualCodexExecutionLoop?.mode || "manual-codex-execution-loop-preview"),
      "- Loop enabled: " + (plan.manualCodexExecutionLoop?.loopEnabled !== false),
      "- Manual only: " + (plan.manualCodexExecutionLoop?.manualOnly !== false),
      "- Codex execution enabled: " + Boolean(plan.manualCodexExecutionLoop?.codexExecutionEnabled),
      "- Auto run enabled: " + Boolean(plan.manualCodexExecutionLoop?.autoRunEnabled),
    ])
    .concat((plan.manualCodexExecutionLoop?.steps || []).map((item) => "- Step: " + item))
    .concat((plan.manualCodexExecutionLoop?.requiredHumanActions || []).map((item) => "- Required human action: " + item))
    .concat((plan.manualCodexExecutionLoop?.blockedReasons || []).map((item) => "- Blocker: " + item))
    .concat([
      "",
      "## Codex Result Review Preview",
      "- Phase: " + (plan.codexResultReviewPreview?.phase || WORKFORCE_PLAN_CODEX_RESULT_REVIEW_PHASE),
      "- Mode: " + (plan.codexResultReviewPreview?.mode || "codex-result-review-preview"),
      "- Review enabled: " + (plan.codexResultReviewPreview?.reviewEnabled !== false),
      "- Manual paste only: " + (plan.codexResultReviewPreview?.manualPasteOnly !== false),
      "- Auto apply enabled: " + Boolean(plan.codexResultReviewPreview?.autoApplyEnabled),
      "- Auto merge enabled: " + Boolean(plan.codexResultReviewPreview?.autoMergeEnabled),
      "- Auto commit enabled: " + Boolean(plan.codexResultReviewPreview?.autoCommitEnabled),
    ])
    .concat((plan.codexResultReviewPreview?.expectedResultSections || []).map((item) => "- Expected result section: " + item))
    .concat((plan.codexResultReviewPreview?.reviewChecklist || []).map((item) => "- Review checklist: " + item))
    .concat((plan.codexResultReviewPreview?.blockedReasons || []).map((item) => "- Blocker: " + item))
    .concat([
      "",
      "## Safe Desktop Runner Design",
      "- Phase: " + (plan.safeDesktopRunnerDesign?.phase || WORKFORCE_PLAN_SAFE_DESKTOP_RUNNER_DESIGN_PHASE),
      "- Mode: " + (plan.safeDesktopRunnerDesign?.mode || "safe-desktop-runner-design-only"),
      "- Runner implemented: " + Boolean(plan.safeDesktopRunnerDesign?.runnerImplemented),
      "- Runner enabled: " + Boolean(plan.safeDesktopRunnerDesign?.runnerEnabled),
      "- Codex CLI invocation enabled: " + Boolean(plan.safeDesktopRunnerDesign?.codexCliInvocationEnabled),
      "- Execution enabled: " + Boolean(plan.safeDesktopRunnerDesign?.executionEnabled),
      "- Design only: " + (plan.safeDesktopRunnerDesign?.designOnly !== false),
    ])
    .concat((plan.safeDesktopRunnerDesign?.requiredBeforeImplementation || []).map((item) => "- Required before implementation: " + item))
    .concat((plan.safeDesktopRunnerDesign?.forbiddenByDefault || []).map((item) => "- Forbidden by default: " + item))
    .concat((plan.safeDesktopRunnerDesign?.blockedReasons || []).map((item) => "- Blocker: " + item))
    .concat([
      "",
      "## Plan State / HUD",
      "- Current state: " + (plan.planState?.current || "n/a"),
      "- Lifecycle status: " + (plan.planState?.lifecycleStatus || "n/a"),
      "- Workflow run handoff: " + (plan.planState?.workflowRunHandoff?.status || "n/a"),
      "- Lifecycle preview: " + (plan.lifecyclePreview?.current || "n/a"),
      "",
      "## Review Package Preview",
      "- Phase: " + (plan.reviewPackagePreview?.phase || WORKFORCE_PLAN_REVIEW_APPROVAL_PHASE),
      "- Status: " + (plan.reviewPackagePreview?.status || "n/a"),
      "- Clarification coverage: " + (plan.reviewPackagePreview?.summary?.clarificationCoverage || "n/a"),
      "- Workflow run handoff: " + (plan.reviewPackagePreview?.disabledWorkflowRunHandoff?.status || "disabled"),
      "",
      "## Human Approval Gate Preview",
      "- Status: " + (plan.approvalGatePreview?.status || "waiting-human-review"),
      "- Decision: " + (plan.approvalGatePreview?.currentDecision || "n/a"),
      "- Workflow run enabled: " + Boolean(plan.approvalGatePreview?.workflowRunEnabled),
    ])
    .concat([
      "",
      "## Tasks",
    ])
    .concat((plan.taskBreakdown || []).map((item) => "- " + item.taskId + " / " + item.role + ": " + item.description))
    .concat([
      "",
      "## Deliverables",
    ])
    .concat((plan.deliverables || []).map((item) => "- " + item.title + ": " + item.description + " (" + item.ownerRole + ")"))
    .concat([
      "",
      "## Acceptance Criteria",
    ])
    .concat((plan.acceptanceCriteria || []).map((item) => "- " + item))
    .concat([
      "",
      "## Risks",
    ])
    .concat((plan.risks || []).map((item) => "- " + item))
    .concat([
      "",
      "## Next Actions",
    ])
    .concat((plan.nextActions || []).map((item) => "- " + item));

  return lines.join("\n");
}
