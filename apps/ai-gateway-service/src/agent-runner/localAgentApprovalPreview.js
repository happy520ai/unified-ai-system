import {
  ALLOWED_COMMAND_PREFIXES,
  BLOCKED_COMMAND_PATTERNS,
  BLOCKED_PATHS,
  getPermissionModePolicy,
} from "./permissionModePolicy.js";
import { classifyLocalAgentIntent } from "./localAgentIntentClassifier.js";

export function createLocalAgentApprovalPreview(input, options = {}) {
  const text = String(input ?? "");
  const classification = options.classification ?? classifyLocalAgentIntent(text);
  const policy = options.policy ?? getPermissionModePolicy(classification.recommendedPermissionMode) ?? getPermissionModePolicy("manual");
  const allowedFiles = normalizeAllowedFiles(options.allowedFiles);
  const blockedReasons = buildBlockedReasons(classification, allowedFiles);

  return {
    phase: "302A",
    mode: "ui-ready-local-agent-approval-preview",
    operationId: buildOperationId(text),
    intentType: classification.intentType,
    riskLevel: classification.riskLevel,
    recommendedPermissionMode: classification.recommendedPermissionMode,
    allowedFilesRequired: true,
    allowedFiles,
    forbiddenPaths: BLOCKED_PATHS,
    allowedCommands: classification.blocked ? [] : ALLOWED_COMMAND_PREFIXES,
    blockedCommands: BLOCKED_COMMAND_PATTERNS,
    approvalPoints: buildApprovalPoints(classification.intentType, classification.blocked),
    approvalRequired: !classification.blocked,
    approvedByUser: false,
    approvedAt: null,
    status: "draft",
    dryRun: true,
    fullOpenAllowed: false,
    autoCommit: false,
    autoPush: false,
    releaseOrDeploy: false,
    permissionModePreview: {
      id: policy?.id ?? "manual",
      fullOpenEnabled: false,
      autoRunSafeVerifiers: policy?.autoRunSafeVerifiers ?? false,
      requireApprovalBeforeWrite: policy?.requireApprovalBeforeWrite ?? true,
      requireApprovalBeforePatchApply: policy?.requireApprovalBeforePatchApply ?? true,
      notes: Array.isArray(policy?.notes) ? policy.notes : [],
    },
    blockers: blockedReasons,
    warnings: buildWarnings(classification, allowedFiles),
    nextStepAdvice: buildNextStepAdvice(classification, allowedFiles),
    executionPreview: {
      willWriteFiles: false,
      willApplyPatch: false,
      willRunCommands: false,
      willCallExternalProvider: false,
      willCommitOrPush: false,
      fullOpenEnabled: false,
      dryRunDefault: true,
    },
    readyToPreview: true,
  };
}

export function isLocalAgentApprovalPreviewReady(preview) {
  return Boolean(preview)
    && preview.phase === "302A"
    && preview.allowedFilesRequired === true
    && preview.fullOpenAllowed === false
    && preview.autoCommit === false
    && preview.autoPush === false
    && preview.releaseOrDeploy === false;
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

function buildOperationId(input) {
  const normalized = String(input ?? "").trim().toLowerCase();
  const seed = normalized || "local-intent-preview";
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return `phase302a-${hash.toString(16)}`;
}

function buildApprovalPoints(intentType, blocked) {
  if (blocked) {
    return [
      "The request is blocked before any approval preview can become actionable.",
      "No approval record can authorize a blocked intent.",
    ];
  }

  if (intentType === "patch_proposal_request" || intentType === "verifier_fix_request") {
    return [
      "Confirm the allowedFiles list before any future write-capable phase.",
      "Review the diff preview and the rollback manifest before any later apply step.",
    ];
  }

  return [
    "Confirm the local-only scope and the permission mode recommendation.",
    "Confirm that allowedFiles will be explicit before any future patch apply.",
  ];
}

function buildWarnings(classification, allowedFiles) {
  const warnings = [];

  if (classification.requiresApproval) {
    warnings.push("approval-required-before-any-future-write-capable-step");
  }

  if (!allowedFiles.length) {
    warnings.push("allowedFiles-will-be-required-before-any-future-apply");
  }

  if (classification.intentType === "patch_proposal_request" || classification.intentType === "verifier_fix_request") {
    warnings.push("write-capable-follow-up-remains-out-of-scope-for-phase302a");
  }

  return warnings;
}

function buildBlockedReasons(classification, allowedFiles) {
  const reasons = [];

  if (classification.blocked) {
    reasons.push(...classification.reasons);
  }

  if (!allowedFiles.length) {
    reasons.push("allowed-files-not-yet-supplied");
  }

  return Array.from(new Set(reasons));
}

function buildNextStepAdvice(classification, allowedFiles) {
  if (classification.blocked) {
    return [
      "Stop and refuse the unsafe request.",
      "Ask for a safe, local-only request that stays away from secrets, legacy/, destructive git, or release/deploy actions.",
    ];
  }

  const advice = [
    "Use this preview to explain the intent, risks, permission mode, and approval points.",
    "When you move into Phase303A-305A, require an explicit allowedFiles list before any apply step.",
  ];

  if (!allowedFiles.length) {
    advice.push("allowedFiles is currently empty in preview; that is acceptable here but not for a future apply.");
  }

  return advice;
}
