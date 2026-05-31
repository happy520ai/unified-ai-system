import {
  ALLOWED_COMMAND_PREFIXES,
  BLOCKED_COMMAND_PATTERNS,
  BLOCKED_PATHS,
  getPermissionModePolicy,
} from "./permissionModePolicy.js";
import { classifyLocalAgentIntent } from "./localAgentIntentClassifier.js";
import { createLocalAgentApprovalPreview } from "./localAgentApprovalPreview.js";

export function createLocalAgentIntentExplainer(input, options = {}) {
  const text = String(input ?? "");
  const classification = classifyLocalAgentIntent(text);
  const policy = getPermissionModePolicy(classification.recommendedPermissionMode) ?? getPermissionModePolicy("manual");
  const allowedFiles = normalizeAllowedFiles(options.allowedFiles);
  const approvalPreview = createLocalAgentApprovalPreview(text, {
    allowedFiles,
    classification,
    policy,
  });

  return {
    phase: "302A",
    mode: "ui-ready-intent-explanation-preview",
    input: text,
    classification,
    explanation: buildExplanation(classification),
    permissionPreview: {
      recommendedPermissionMode: classification.recommendedPermissionMode,
      fullOpenAllowed: false,
      explanation: buildPermissionExplanation(classification, policy),
      requireApprovalBeforeWrite: policy?.requireApprovalBeforeWrite ?? true,
      requireApprovalBeforePatchApply: policy?.requireApprovalBeforePatchApply ?? true,
      autoRunSafeVerifiers: policy?.autoRunSafeVerifiers ?? false,
      autoCommit: false,
      autoPush: false,
      releaseOrDeployAllowed: false,
    },
    approvalPreview,
    fileBoundaryPreview: {
      allowedFilesRequired: true,
      allowedFiles,
      forbiddenPaths: BLOCKED_PATHS,
    },
    commandPreview: {
      allowedCommandPrefixes: classification.blocked ? [] : ALLOWED_COMMAND_PREFIXES,
      blockedCommandPatterns: BLOCKED_COMMAND_PATTERNS,
    },
    executionPreview: {
      willWriteFiles: false,
      willApplyPatch: false,
      willRunCommands: false,
      willCallExternalProvider: false,
      willCommitOrPush: false,
      fullOpenEnabled: false,
      dryRunDefault: true,
    },
    nextStepAdvice: buildNextStepAdvice(classification, allowedFiles),
    uiReady: true,
  };
}

function normalizeAllowedFiles(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return Array.from(new Set(
    input
      .map((entry) => String(entry ?? "").replace(/\\/g, "/").trim())
      .filter(Boolean),
  ));
}

function buildExplanation(classification) {
  if (classification.blocked) {
    return [
      "The request is blocked before any local operation can be considered.",
      "No patch apply, command execution, or file write is allowed from this preview.",
    ];
  }

  return [
    `Intent type: ${classification.intentType}`,
    `Risk level: ${classification.riskLevel}`,
    `Recommended permission mode: ${classification.recommendedPermissionMode}`,
  ];
}

function buildPermissionExplanation(classification, policy) {
  if (classification.blocked) {
    return [
      "Blocked requests remain blocked even in preview.",
      "No permission mode upgrade can override the safety boundary.",
    ];
  }

  return [
    `Use ${classification.recommendedPermissionMode} for bounded local review.`,
    policy?.autoRunSafeVerifiers
      ? "Auto Review Mode can preview safe verifier checks, but it still cannot apply patches automatically."
      : "Manual mode keeps execution and file mutation out of this phase.",
    "full_open is disabled and cannot be selected.",
  ];
}

function buildNextStepAdvice(classification, allowedFiles) {
  if (classification.blocked) {
    return [
      "Refuse the unsafe request and stay in preview mode.",
      "Ask for a safe, local-only task that does not involve secrets, destructive git commands, or release/deploy actions.",
    ];
  }

  const advice = [
    "Review the intent explanation and approval points before any future write-capable phase.",
    "If the task is a verifier fix or patch proposal, specify the exact allowed files in the next phase.",
  ];

  if (!allowedFiles.length) {
    advice.push("allowedFiles is not yet supplied in this phase; it becomes mandatory before any later patch apply.");
  }

  return advice;
}
