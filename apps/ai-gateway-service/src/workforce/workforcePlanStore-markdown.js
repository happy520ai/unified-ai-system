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
    "# Agent Workforce Task Package", "",
    "- Plan ID: " + planId,
    "- Workforce ID: " + (plan.workforceId || "n/a"),
    "- Plan version: " + (plan.planVersion || "n/a"),
    "- Created at: " + (plan.createdAt || "n/a"),
    "- Saved at: " + savedAt,
    "- Goal: " + plan.goal,
    "- Selected template: " + (plan.selectedTemplate?.name || plan.templateContext?.selectedTemplateName || "n/a"), "",
    "## Product Templates Preview",
    "- Phase: " + (plan.productTemplatesPreview?.phase || WORKFORCE_PLAN_PRODUCT_TEMPLATE_PACK_PHASE),
    "- Mode: " + (plan.productTemplatesPreview?.mode || "product-template-pack-preview"),
    "- Template pack enabled: " + (plan.productTemplatesPreview?.templatePackEnabled !== false),
    "- Execution enabled: " + Boolean(plan.productTemplatesPreview?.executionEnabled),
    "- Selected template: " + (plan.productTemplatesPreview?.selectedTemplateId || plan.selectedTemplate?.id || "n/a"),
  ]
    .concat((plan.productTemplatesPreview?.templates || []).map((t) => "- Template: " + t.name + " (" + t.id + ") - " + t.description + "; execution=" + t.execution))
    .concat((plan.productTemplatesPreview?.templates || []).flatMap((t) => [
      "- Sample goal for " + t.id + ": " + (t.sampleGoal || "n/a"),
      ...((t.expectedPlanSections || []).map((s) => "  - Expected section: " + s)),
      ...((t.sampleAcceptanceChecklist || []).map((c) => "  - Sample acceptance: " + c)),
    ]))
    .concat((plan.productTemplatesPreview?.demoGoals || []).map((i) => "- Demo goal: " + i.templateName + " - " + i.sampleGoal + "; execution=" + i.execution))
    .concat((plan.productTemplatesPreview?.blockedReasons || []).map((i) => "- Blocker: " + i))
    .concat(["", "## Template Context",
      "- Phase: " + (plan.templateContext?.phase || WORKFORCE_PLAN_PRODUCT_TEMPLATE_PACK_PHASE),
      "- Selected template: " + (plan.templateContext?.selectedTemplateName || plan.selectedTemplate?.name || "n/a"),
      "- Execution enabled: " + Boolean(plan.templateContext?.executionEnabled),
      "- External runner dispatch enabled: " + Boolean(plan.templateContext?.externalRunnerDispatchEnabled),
      "- Workflow run enabled: " + Boolean(plan.templateContext?.workflowRunEnabled),
    ])
    .concat((plan.templateContext?.focusAreas || []).map((i) => "- Focus area: " + i))
    .concat((plan.templateContext?.expectedOutputs || []).map((i) => "- Expected output: " + i))
    .concat((plan.templateContext?.expectedPlanSections || []).map((i) => "- Expected plan section: " + i))
    .concat((plan.templateContext?.sampleAcceptanceChecklist || []).map((i) => "- Sample acceptance: " + i))
    .concat(["", "## Summary", plan.summary || "", "", "## Roles"])
    .concat((plan.roleAssignments || []).map((i) => "- " + i.role + ": " + i.responsibility))
    .concat(["", "## Role Tiers"])
    .concat((plan.roleTiers || []).flatMap((t) => ["- " + t.name + ": " + t.purpose, ...(t.roles || []).map((r) => "  - " + r.role + ": " + r.responsibility)]))
    .concat(["", "## Clarification Questions"])
    .concat((plan.clarifyQuestions || []).map((i) => "- " + i.topic + ": " + i.question))
    .concat(["", "## Clarification Answers"])
    .concat((plan.clarificationAnswers || []).map((i) => "- " + i.questionId + ": " + i.answer))
    .concat(["", "## Answered Clarifications"])
    .concat((plan.answeredClarifications || []).map((i) => "- " + i.questionId + ": " + i.answer))
    .concat(["", "## Unresolved Clarifications"])
    .concat((plan.unresolvedClarifications || []).map((i) => "- " + i.questionId + ": " + i.question))
    .concat(["", "## Consensus Preview"])
    .concat((plan.consensusPreview || []).map((i) => "- " + i.role + ": " + i.recommendation))
    .concat(["", "## Hook Events Preview"])
    .concat((plan.hookEventsPreview || []).map((i) => "- " + i.event + ": enabled=" + i.enabled))
    .concat(["", "## Event Ledger Preview"])
    .concat((plan.eventLedgerPreview || []).map((i) => "- " + i.eventName + ": enabled=" + i.enabled + "; execution=" + i.execution + "; " + i.payloadSummary))
    .concat(["", "## Agent Workforce HUD Preview",
      "- Phase: " + (plan.workforceHudPreview?.phase || WORKFORCE_PLAN_ROLE_TIER_EVENT_LEDGER_PHASE),
      "- Plan State: " + (plan.workforceHudPreview?.planState || "n/a"),
      "- Clarification: " + (plan.workforceHudPreview?.clarification?.answered ?? 0) + "/" + (plan.workforceHudPreview?.clarification?.total ?? 0),
      "- Consensus: " + (plan.workforceHudPreview?.consensus?.ready ? "ready" : "needs review"),
      "- Review Package: " + (plan.workforceHudPreview?.reviewPackage?.status || "n/a"),
      "- Approval Gate: " + (plan.workforceHudPreview?.approvalGate?.status || "waiting-human-review"),
      "- Workflow Handoff: " + (plan.workforceHudPreview?.workflowHandoff?.status || "disabled"),
      "- OMX Handoff: " + (plan.workforceHudPreview?.omxHandoff?.status || "preview-only"),
      "- Execution: " + (plan.workforceHudPreview?.execution?.status || "disabled"),
      "- Execution readiness: " + (plan.workforceHudPreview?.execution?.readiness || "blocked"), "",
      "## OMX Handoff Preview",
      "- Phase: " + (plan.omxHandoffPreview?.phase || "phase-142a-workforce-omx-handoff-preview"),
      "- Mode: " + (plan.omxHandoffPreview?.mode || "omx-compatible-preview"),
      "- Status: " + (plan.omxHandoffPreview?.status || "handoff-preview-ready"),
      "- Recommended workflow: " + (plan.omxHandoffPreview?.recommendedWorkflow || "deep-interview -> ralplan -> team/ralph"),
      "- Execution enabled: " + Boolean(plan.omxHandoffPreview?.executionEnabled),
      "- Runs oh-my-codex: " + Boolean(plan.omxHandoffPreview?.runsOhMyCodex),
      "- Creates worktrees: " + Boolean(plan.omxHandoffPreview?.createsWorktrees), "",
      "## Execution Readiness Preflight",
      "- Phase: " + (plan.executionReadinessPreflight?.phase || WORKFORCE_PLAN_EXECUTION_READINESS_PREFLIGHT_PHASE),
      "- Mode: " + (plan.executionReadinessPreflight?.mode || "preview-only"),
      "- Overall status: " + (plan.executionReadinessPreflight?.overallStatus || "blocked"),
      "- Execution enabled: " + Boolean(plan.executionReadinessPreflight?.executionEnabled),
    ])
    .concat((plan.executionReadinessPreflight?.checks || []).map((i) => "- " + i.name + ": " + i.status + "; required=" + i.required + "; " + i.reason))
    .concat((plan.executionReadinessPreflight?.blockedReasons || []).map((i) => "- Blocker: " + i))
    .concat([
      "- Recommended next step: " + (plan.executionReadinessPreflight?.recommendedNextStep || "Design external runner protocol before enabling execution"), "",
      "## External OMX Runner Design",
      "- Phase: " + (plan.externalOmxRunnerDesign?.phase || WORKFORCE_PLAN_EXTERNAL_OMX_RUNNER_DESIGN_PHASE),
      "- Mode: " + (plan.externalOmxRunnerDesign?.mode || "external-runner-design"),
      "- Runner enabled: " + Boolean(plan.externalOmxRunnerDesign?.runnerEnabled),
      "- Execution enabled: " + Boolean(plan.externalOmxRunnerDesign?.executionEnabled),
      "- Design only: " + (plan.externalOmxRunnerDesign?.designOnly !== false),
    ])
    .concat((plan.externalOmxRunnerDesign?.proposedEndpoints || []).map((i) => "- Proposed endpoint: " + i.method + " " + i.path + "; execution=" + i.execution + "; " + i.purpose))
    .concat((plan.externalOmxRunnerDesign?.requiredPreflightChecks || []).map((i) => "- Required preflight check: " + i))
    .concat((plan.externalOmxRunnerDesign?.blockedReasons || []).map((i) => "- Blocker: " + i))
    .concat(["", "## Runner Request Review Queue Preview",
      "- Phase: " + (plan.runnerRequestQueuePreview?.phase || WORKFORCE_PLAN_RUNNER_REQUEST_QUEUE_PHASE),
      "- Mode: " + (plan.runnerRequestQueuePreview?.mode || "review-queue-preview"),
      "- Queue enabled: " + Boolean(plan.runnerRequestQueuePreview?.queueEnabled),
      "- Execution enabled: " + Boolean(plan.runnerRequestQueuePreview?.executionEnabled),
      "- Request state: " + (plan.runnerRequestQueuePreview?.requestState || "draft-review-only"),
      "- Auto dispatch enabled: " + Boolean(plan.runnerRequestQueuePreview?.queuePolicy?.autoDispatchEnabled),
      "- External runner dispatch enabled: " + Boolean(plan.runnerRequestQueuePreview?.queuePolicy?.externalRunnerDispatchEnabled),
      "- Approval preview is execution permission: " + Boolean(plan.runnerRequestQueuePreview?.queuePolicy?.approvalPreviewIsExecutionPermission),
    ])
    .concat((plan.runnerRequestQueuePreview?.blockedReasons || []).map((i) => "- Blocker: " + i))
    .concat([
      "- Recommended next step: " + (plan.runnerRequestQueuePreview?.recommendedNextStep || "Record approval decision preview before any future runner request can be considered"), "",
      "## Execution Request Approval Record Preview",
      "- Phase: " + (plan.executionApprovalRecordPreview?.phase || WORKFORCE_PLAN_EXECUTION_APPROVAL_RECORD_PHASE),
      "- Mode: " + (plan.executionApprovalRecordPreview?.mode || "approval-record-preview"),
      "- Approval record enabled: " + Boolean(plan.executionApprovalRecordPreview?.approvalRecordEnabled),
      "- Execution enabled: " + Boolean(plan.executionApprovalRecordPreview?.executionEnabled),
      "- Approval state: " + (plan.executionApprovalRecordPreview?.approvalState || "not-approved-for-execution"),
      "- Approval preview is execution permission: " + Boolean(plan.executionApprovalRecordPreview?.approvalPolicy?.approvalPreviewIsExecutionPermission),
    ])
    .concat((plan.executionApprovalRecordPreview?.recordFieldsPreview || []).map((i) => "- Record field preview: " + i))
    .concat((plan.executionApprovalRecordPreview?.blockedReasons || []).map((i) => "- Blocker: " + i))
    .concat([
      "- Recommended next step: " + (plan.executionApprovalRecordPreview?.recommendedNextStep || "Freeze external runner protocol before implementing any real runner"), "",
      "## External Runner Protocol Freeze",
      "- Phase: " + (plan.externalRunnerProtocolFreeze?.phase || WORKFORCE_PLAN_EXTERNAL_RUNNER_PROTOCOL_FREEZE_PHASE),
      "- Mode: " + (plan.externalRunnerProtocolFreeze?.mode || "protocol-freeze"),
      "- Protocol version: " + (plan.externalRunnerProtocolFreeze?.protocolVersion || "preview-1"),
      "- Frozen: " + (plan.externalRunnerProtocolFreeze?.frozen !== false),
      "- Runner enabled: " + Boolean(plan.externalRunnerProtocolFreeze?.runnerEnabled),
      "- Execution enabled: " + Boolean(plan.externalRunnerProtocolFreeze?.executionEnabled),
      "- Design only: " + (plan.externalRunnerProtocolFreeze?.designOnly !== false),
    ])
    .concat((plan.externalRunnerProtocolFreeze?.coveredCapabilities || []).map((i) => "- Covered capability: " + i))
    .concat((plan.externalRunnerProtocolFreeze?.frozenInvariants || []).map((i) => "- Frozen invariant: " + i))
    .concat((plan.externalRunnerProtocolFreeze?.requiredBeforeRealExecution || []).map((i) => "- Required before real execution: " + i))
    .concat((plan.externalRunnerProtocolFreeze?.blockedReasons || []).map((i) => "- Blocker: " + i))
    .concat(["", "## Agent Workforce Preview Final UX Seal",
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
    .concat((plan.agentWorkforcePreviewFinalUxSeal?.userPath || []).map((i) => "- User path: " + i))
    .concat((plan.agentWorkforcePreviewFinalUxSeal?.finalUiMessages || []).map((i) => "- Final UX message: " + i))
    .concat((plan.agentWorkforcePreviewFinalUxSeal?.blockedReasons || []).map((i) => "- Blocker: " + i))
    .concat([
      "- Recommended next step: " + (plan.agentWorkforcePreviewFinalUxSeal?.recommendedNextStep || "Keep Agent Workforce as a productized preview console until a later explicit real-execution mainline is approved."), "",
      "## Export / Handoff Explanation",
      "- Export is a handoff package for human review, not an execution package.",
      "- Suggested OMX commands are text only and are not executed.",
      "- approval-preview is not execution approval.",
      "- executionEnabled=false is preserved in the export.", "",
      "## Handoff Package Manifest",
      "- Phase: " + (plan.handoffPackageManifest?.phase || WORKFORCE_PLAN_HANDOFF_PACKAGE_MANIFEST_PHASE),
      "- Mode: " + (plan.handoffPackageManifest?.mode || "handoff-package-manifest-preview"),
      "- Manifest enabled: " + (plan.handoffPackageManifest?.manifestEnabled !== false),
      "- Execution enabled: " + Boolean(plan.handoffPackageManifest?.executionEnabled),
      "- Runner enabled: " + Boolean(plan.handoffPackageManifest?.runnerEnabled),
      "- Workflow run enabled: " + Boolean(plan.handoffPackageManifest?.workflowRunEnabled),
      "- Package purpose: " + (plan.handoffPackageManifest?.packagePurpose || "Human-readable Agent Workforce preview handoff package; not execution."),
    ])
    .concat((plan.handoffPackageManifest?.includedSections || []).map((i) => "- Included section: " + i))
    .concat((plan.handoffPackageManifest?.externalRunnerDisabledReasons || []).map((i) => "- External runner disabled reason: " + i))
    .concat((plan.handoffPackageManifest?.blockedReasons || []).map((i) => "- Blocker: " + i))
    .concat(["", "## Codex Desktop Handoff Pack",
      "- Phase: " + (plan.codexDesktopHandoffPack?.phase || WORKFORCE_PLAN_CODEX_DESKTOP_HANDOFF_PACK_PHASE),
      "- Mode: " + (plan.codexDesktopHandoffPack?.mode || "codex-desktop-handoff-preview"),
      "- Manual copy/paste only: " + (plan.codexDesktopHandoffPack?.manualOnly !== false),
      "- Codex execution enabled in web system: " + Boolean(plan.codexDesktopHandoffPack?.codexExecutionEnabled),
      "- Auto dispatch enabled: " + Boolean(plan.codexDesktopHandoffPack?.autoDispatchEnabled),
      "- Target: " + (plan.codexDesktopHandoffPack?.target || "desktop-codex-or-codex-cli"),
      "- Copy/paste required: " + (plan.codexDesktopHandoffPack?.copyPasteRequired !== false),
      "- Task goal: " + (plan.codexDesktopHandoffPack?.taskGoal || plan.goal || "n/a"),
    ])
    .concat((plan.codexDesktopHandoffPack?.contextSummary || []).map((i) => "- Context: " + i))
    .concat((plan.codexDesktopHandoffPack?.allowedFiles || []).map((i) => "- Allowed file: " + i))
    .concat((plan.codexDesktopHandoffPack?.forbiddenActions || []).map((i) => "- Forbidden action: " + i))
    .concat((plan.codexDesktopHandoffPack?.implementationConstraints || []).map((i) => "- Implementation constraint: " + i))
    .concat((plan.codexDesktopHandoffPack?.verificationCommands || []).map((i) => "- Verification command: " + i))
    .concat((plan.codexDesktopHandoffPack?.evidenceExpectations || []).map((i) => "- Evidence expectation: " + i))
    .concat((plan.codexDesktopHandoffPack?.responseFormat || []).map((i) => "- Response format: " + i))
    .concat((plan.codexDesktopHandoffPack?.blockedReasons || []).map((i) => "- Blocker: " + i))
    .concat(["", "## Manual Codex Execution Loop",
      "- Phase: " + (plan.manualCodexExecutionLoop?.phase || WORKFORCE_PLAN_MANUAL_CODEX_EXECUTION_LOOP_PHASE),
      "- Mode: " + (plan.manualCodexExecutionLoop?.mode || "manual-codex-execution-loop-preview"),
      "- Loop enabled: " + (plan.manualCodexExecutionLoop?.loopEnabled !== false),
      "- Manual only: " + (plan.manualCodexExecutionLoop?.manualOnly !== false),
      "- Codex execution enabled: " + Boolean(plan.manualCodexExecutionLoop?.codexExecutionEnabled),
      "- Auto run enabled: " + Boolean(plan.manualCodexExecutionLoop?.autoRunEnabled),
    ])
    .concat((plan.manualCodexExecutionLoop?.steps || []).map((i) => "- Step: " + i))
    .concat((plan.manualCodexExecutionLoop?.requiredHumanActions || []).map((i) => "- Required human action: " + i))
    .concat((plan.manualCodexExecutionLoop?.blockedReasons || []).map((i) => "- Blocker: " + i))
    .concat(["", "## Codex Result Review Preview",
      "- Phase: " + (plan.codexResultReviewPreview?.phase || WORKFORCE_PLAN_CODEX_RESULT_REVIEW_PHASE),
      "- Mode: " + (plan.codexResultReviewPreview?.mode || "codex-result-review-preview"),
      "- Review enabled: " + (plan.codexResultReviewPreview?.reviewEnabled !== false),
      "- Manual paste only: " + (plan.codexResultReviewPreview?.manualPasteOnly !== false),
      "- Auto apply enabled: " + Boolean(plan.codexResultReviewPreview?.autoApplyEnabled),
      "- Auto merge enabled: " + Boolean(plan.codexResultReviewPreview?.autoMergeEnabled),
      "- Auto commit enabled: " + Boolean(plan.codexResultReviewPreview?.autoCommitEnabled),
    ])
    .concat((plan.codexResultReviewPreview?.expectedResultSections || []).map((i) => "- Expected result section: " + i))
    .concat((plan.codexResultReviewPreview?.reviewChecklist || []).map((i) => "- Review checklist: " + i))
    .concat((plan.codexResultReviewPreview?.blockedReasons || []).map((i) => "- Blocker: " + i))
    .concat(["", "## Safe Desktop Runner Design",
      "- Phase: " + (plan.safeDesktopRunnerDesign?.phase || WORKFORCE_PLAN_SAFE_DESKTOP_RUNNER_DESIGN_PHASE),
      "- Mode: " + (plan.safeDesktopRunnerDesign?.mode || "safe-desktop-runner-design-only"),
      "- Runner implemented: " + Boolean(plan.safeDesktopRunnerDesign?.runnerImplemented),
      "- Runner enabled: " + Boolean(plan.safeDesktopRunnerDesign?.runnerEnabled),
      "- Codex CLI invocation enabled: " + Boolean(plan.safeDesktopRunnerDesign?.codexCliInvocationEnabled),
      "- Execution enabled: " + Boolean(plan.safeDesktopRunnerDesign?.executionEnabled),
      "- Design only: " + (plan.safeDesktopRunnerDesign?.designOnly !== false),
    ])
    .concat((plan.safeDesktopRunnerDesign?.requiredBeforeImplementation || []).map((i) => "- Required before implementation: " + i))
    .concat((plan.safeDesktopRunnerDesign?.forbiddenByDefault || []).map((i) => "- Forbidden by default: " + i))
    .concat((plan.safeDesktopRunnerDesign?.blockedReasons || []).map((i) => "- Blocker: " + i))
    .concat(["", "## Plan State / HUD",
      "- Current state: " + (plan.planState?.current || "n/a"),
      "- Lifecycle status: " + (plan.planState?.lifecycleStatus || "n/a"),
      "- Workflow run handoff: " + (plan.planState?.workflowRunHandoff?.status || "n/a"),
      "- Lifecycle preview: " + (plan.lifecyclePreview?.current || "n/a"), "",
      "## Review Package Preview",
      "- Phase: " + (plan.reviewPackagePreview?.phase || WORKFORCE_PLAN_REVIEW_APPROVAL_PHASE),
      "- Status: " + (plan.reviewPackagePreview?.status || "n/a"),
      "- Clarification coverage: " + (plan.reviewPackagePreview?.summary?.clarificationCoverage || "n/a"),
      "- Workflow run handoff: " + (plan.reviewPackagePreview?.disabledWorkflowRunHandoff?.status || "disabled"), "",
      "## Human Approval Gate Preview",
      "- Status: " + (plan.approvalGatePreview?.status || "waiting-human-review"),
      "- Decision: " + (plan.approvalGatePreview?.currentDecision || "n/a"),
      "- Workflow run enabled: " + Boolean(plan.approvalGatePreview?.workflowRunEnabled),
    ])
    .concat(["", "## Tasks"])
    .concat((plan.taskBreakdown || []).map((i) => "- " + i.taskId + " / " + i.role + ": " + i.description))
    .concat(["", "## Deliverables"])
    .concat((plan.deliverables || []).map((i) => "- " + i.title + ": " + i.description + " (" + i.ownerRole + ")"))
    .concat(["", "## Acceptance Criteria"])
    .concat((plan.acceptanceCriteria || []).map((i) => "- " + i))
    .concat(["", "## Risks"])
    .concat((plan.risks || []).map((i) => "- " + i))
    .concat(["", "## Next Actions"])
    .concat((plan.nextActions || []).map((i) => "- " + i));
  return lines.join("\n");
}
