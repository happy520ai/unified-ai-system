import {
  ALLOWED_COMMAND_PREFIXES,
  BLOCKED_COMMAND_PATTERNS,
  BLOCKED_PATHS,
  getPermissionModePolicy,
} from "./permissionModePolicy.js";
import { getOperatorPreviewState } from "./operatorPreviewState.js";
import { classifyLocalAgentIntent } from "./localAgentIntentClassifier.js";

export function createLocalAgentIntentPreview(input) {
  const text = String(input ?? "");
  const classification = classifyLocalAgentIntent(text);
  const policy = getPermissionModePolicy(classification.recommendedPermissionMode) ?? getPermissionModePolicy("manual");
  const operatorPreview = getOperatorPreviewState();

  return {
    phase: "301A",
    mode: "chat-to-local-agent-intent-preview-only",
    input: text,
    classification,
    permissionPreview: {
      recommendedPermissionMode: classification.recommendedPermissionMode,
      fullOpenAllowed: false,
      requireApprovalBeforeWrite: policy?.requireApprovalBeforeWrite ?? true,
      requireApprovalBeforePatchApply: policy?.requireApprovalBeforePatchApply ?? true,
      autoRunSafeVerifiers: policy?.autoRunSafeVerifiers ?? false,
      explanation: classification.blocked
        ? "This intent is blocked before any local action can be considered."
        : `This intent stays in ${classification.recommendedPermissionMode} preview mode only.`,
    },
    approvalPreview: {
      requiresApproval: classification.requiresApproval,
      blocked: classification.blocked,
      approvalPoints: buildApprovalPoints(classification.intentType, classification.blocked),
    },
    commandPreview: {
      allowedCommandPrefixes: classification.blocked ? [] : ALLOWED_COMMAND_PREFIXES,
      blockedCommandPatterns: BLOCKED_COMMAND_PATTERNS,
      recommendedCommands: classification.blocked ? [] : buildRecommendedCommands(classification.intentType),
    },
    fileBoundaryPreview: {
      allowedFilesRequired: true,
      forbiddenPaths: BLOCKED_PATHS,
    },
    executionPreview: {
      willWriteFiles: false,
      willApplyPatch: false,
      willRunCommands: false,
      willCallExternalProvider: false,
      willCommitOrPush: false,
    },
    operatorStatus: {
      previewOnly: true,
      blockers: classification.blocked ? classification.reasons : [],
      warnings: buildWarnings(classification),
      informational: buildInformational(classification, operatorPreview.phase),
    },
  };
}

function buildApprovalPoints(intentType, blocked) {
  if (blocked) {
    return [
      "The request is blocked before any approval path can start.",
    ];
  }

  if (intentType === "phase_verification" || intentType === "read_only_audit_request") {
    return [
      "Future real verifier execution would still need an explicit operator decision.",
    ];
  }

  if (intentType === "local_command_request") {
    return [
      "Any future real local command run would require operator confirmation under bounded command rules.",
    ];
  }

  return [
    "Any future write-capable step would require explicit approval.",
    "Any future patch apply would require a separate approved record.",
  ];
}

function buildRecommendedCommands(intentType) {
  switch (intentType) {
    case "phase_verification":
      return [
        "cmd /c pnpm run verify:safe-regression-matrix",
        "cmd /c pnpm run health:phase12a",
      ];
    case "verifier_fix_request":
      return [
        "node --check apps/ai-gateway-service/src/entrypoints/<verifier>.js",
        "cmd /c pnpm run verify:<phase-script>",
      ];
    case "documentation_update_request":
      return [
        "cmd /c pnpm -r --if-present check",
      ];
    case "patch_proposal_request":
      return [
        "node --check <candidate-file>",
        "cmd /c pnpm run verify:safe-regression-matrix",
      ];
    case "read_only_audit_request":
      return [
        "cmd /c pnpm run verify:safe-regression-matrix",
        "cmd /c pnpm run doctor:phase13a",
      ];
    case "local_command_request":
      return [
        "cmd /c pnpm run verify:<phase-script>",
        "cmd /c pnpm -r --if-present check",
      ];
    default:
      return [];
  }
}

function buildWarnings(classification) {
  if (classification.blocked) {
    return [];
  }

  const warnings = [];
  if (classification.requiresApproval) {
    warnings.push("approval-required-before-any-future-non-preview-step");
  }
  if (classification.intentType === "patch_proposal_request" || classification.intentType === "verifier_fix_request") {
    warnings.push("write-capable-follow-up-remains-out-of-scope-for-phase301a");
  }
  return warnings;
}

function buildInformational(classification, operatorPreviewPhase) {
  return [
    "Preview only: chat intent classification does not trigger local execution.",
    `Operator preview baseline remains linked to phase ${operatorPreviewPhase}.`,
    `Suggested next step: ${classification.suggestedNextStep}`,
  ];
}
