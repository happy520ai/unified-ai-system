import {
  ALLOWED_COMMAND_PREFIXES,
  BLOCKED_COMMAND_PATTERNS,
  BLOCKED_PATHS,
  DISABLED_MODES,
  FULL_OPEN_DISABLED,
  PERMISSION_MODES,
} from "./permissionModePolicy.js";
import {
  PATCH_APPROVAL_POLICIES,
  PATCH_FORBIDDEN_PATHS,
  PATCH_RUNNER_DEFAULTS,
} from "./patchApprovalPolicy.js";
import {
  AUTO_REVIEW_ALLOWED_COMMAND_PREFIXES,
  AUTO_REVIEW_BLOCKED_COMMANDS,
  AUTO_REVIEW_DEFAULTS,
} from "./autoReviewPolicy.js";
import { GO_NO_GO_STATUSES, buildGoNoGoReview } from "./goNoGoReview.js";
import { getOperatorPreviewExplainer } from "./operatorPreviewExplainer.js";

export function createOperatorPreviewState() {
  const explanations = getOperatorPreviewExplainer();
  const previewReview = buildGoNoGoReview({
    blockers: [],
    warnings: ["preview-only-status-no-review-loop-executed"],
    commandsRun: [],
    commandsSkipped: [],
    evidencePaths: [],
    changedFiles: [],
    boundaryCheck: {
      fullOpenEnabled: false,
      autoCommit: false,
      autoPush: false,
      releaseOrDeploy: false,
    },
    nextSteps: [
      "Review the preview-only status before considering any later approved action.",
    ],
    approvalRequired: true,
  });

  return {
    phase: "299A",
    permissionModes: {
      manual: {
        id: PERMISSION_MODES.manual.id,
        label: PERMISSION_MODES.manual.label,
        fullOpenEnabled: false,
        requireApprovalBeforeWrite: PERMISSION_MODES.manual.requireApprovalBeforeWrite,
        requireApprovalBeforePatchApply: PERMISSION_MODES.manual.requireApprovalBeforePatchApply,
        autoRunSafeVerifiers: PERMISSION_MODES.manual.autoRunSafeVerifiers,
        blockedPaths: BLOCKED_PATHS,
        allowedCommandPrefixes: ALLOWED_COMMAND_PREFIXES,
        blockedCommandPatterns: BLOCKED_COMMAND_PATTERNS,
      },
      auto_review: {
        id: PERMISSION_MODES.auto_review.id,
        label: PERMISSION_MODES.auto_review.label,
        fullOpenEnabled: false,
        requireApprovalBeforeWrite: PERMISSION_MODES.auto_review.requireApprovalBeforeWrite,
        requireApprovalBeforePatchApply: PERMISSION_MODES.auto_review.requireApprovalBeforePatchApply,
        autoRunSafeVerifiers: PERMISSION_MODES.auto_review.autoRunSafeVerifiers,
        blockedPaths: BLOCKED_PATHS,
        allowedCommandPrefixes: ALLOWED_COMMAND_PREFIXES,
        blockedCommandPatterns: BLOCKED_COMMAND_PATTERNS,
      },
      full_open: {
        enabled: false,
        reason: DISABLED_MODES.full_open?.reason ?? "full_open disabled",
      },
    },
    patchRunner: {
      dryRunDefault: PATCH_RUNNER_DEFAULTS.dryRun,
      humanApprovalRequired: PATCH_RUNNER_DEFAULTS.humanApprovalRequired,
      realPatchAppliedByDefault: PATCH_RUNNER_DEFAULTS.realPatchApplyDefault,
      allowedModes: Object.keys(PATCH_APPROVAL_POLICIES),
      forbiddenPaths: PATCH_FORBIDDEN_PATHS,
      approvalPolicies: {
        manual: {
          approvalScope: PATCH_APPROVAL_POLICIES.manual.approvalScope,
          requireApprovalBeforeApply: PATCH_APPROVAL_POLICIES.manual.requireApprovalBeforeApply,
        },
        auto_review: {
          approvalScope: PATCH_APPROVAL_POLICIES.auto_review.approvalScope,
          requireApprovalBeforeApply: PATCH_APPROVAL_POLICIES.auto_review.requireApprovalBeforeApply,
        },
      },
    },
    autoReviewLoop: {
      dryRunDefault: AUTO_REVIEW_DEFAULTS.dryRun,
      maxRoundsDefault: AUTO_REVIEW_DEFAULTS.maxRounds,
      maxRoundsLimit: AUTO_REVIEW_DEFAULTS.maxRoundsLimit,
      autoFixEnabled: false,
      allowedCommands: AUTO_REVIEW_ALLOWED_COMMAND_PREFIXES,
      blockedCommands: AUTO_REVIEW_BLOCKED_COMMANDS,
      stopRules: [
        "blocked-command",
        "verifier-failure",
        "boundary-violation",
        "max-rounds-limit-reached",
      ],
    },
    safety: {
      autoCommitEnabled: false,
      autoPushEnabled: false,
      releaseOrDeployAllowed: false,
      externalProviderCallAllowed: false,
      workflowRunnerAllowed: false,
      worktreeAllowed: false,
      realCodexExecAllowed: false,
    },
    rollbackManifestSummary: {
      recordedFields: [
        "changedFiles",
        "beforeHash-or-beforeSummary",
        "afterHash-or-afterSummary",
      ],
      secretContentRecorded: false,
      envContentRecorded: false,
      autoRollbackEnabled: false,
    },
    explanations,
    evidenceLinkage: {
      currentPhaseEvidence: [
        "apps/ai-gateway-service/evidence/phase-299a-local-agent-operator-preview-panel.json",
        "apps/ai-gateway-service/evidence/phase-300a-operator-preview-visibility.json",
      ],
      upstreamEvidence: [
        "apps/ai-gateway-service/evidence/phase-297a-298a-approved-patch-auto-review-loop.json",
        "apps/ai-gateway-service/evidence/phase-296a-read-only-local-agent-runner.json",
        "apps/ai-gateway-service/evidence/phase-295a-local-agent-permission-mode-gate.json",
        "apps/ai-gateway-service/evidence/phase-294a-safe-refactor-harness.json",
      ],
      linkageMode: "read-only-descriptive",
    },
    goNoGo: {
      statuses: GO_NO_GO_STATUSES,
      previewResult: previewReview,
    },
    runtimeStatus: {
      patchRunnerExecuted: false,
      autoReviewLoopExecuted: false,
      releaseOrDeployCalled: false,
      uiUpdated: false,
      routeAdded: false,
    },
    operatorStatus: {
      mode: "preview-only",
      blockers: [],
      warnings: [],
      informational: [
        "full_open remains disabled.",
        "No patch runner execution is started by this preview.",
        "No auto review loop execution is started by this preview.",
        "Workspace clean state is not claimed by this preview.",
        "Explanation and evidence linkage are visibility-only additions.",
      ],
    },
  };
}

export const OPERATOR_PREVIEW_STATE = createOperatorPreviewState();

export function getOperatorPreviewState() {
  return OPERATOR_PREVIEW_STATE;
}

export function isFullOpenEnabledInOperatorPreview() {
  return FULL_OPEN_DISABLED !== true ? true : OPERATOR_PREVIEW_STATE.permissionModes.full_open.enabled;
}
