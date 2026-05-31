import { createLocalAgentIntentExplainer } from "./localAgentIntentExplainer.js";
import { createLocalAgentIntentPreview } from "./localAgentIntentPreview.js";
import {
  createLocalOperationApprovalRecord,
  validateLocalOperationApprovalRecord,
} from "./localOperationApprovalRecord.js";
import { createLocalOperationPatchProposal } from "./localOperationPatchProposal.js";
import { runApprovedPatch } from "./approvedPatchRunner.js";
import { runAutoReviewLoop } from "./autoReviewLoop.js";
import { createRollbackManifest } from "./rollbackManifest.js";

export const LOCAL_OPERATION_EVIDENCE_PATHS = [
  "apps/ai-gateway-service/evidence/phase-303a-305a-ui-ready-approved-local-operation-loop.json",
  "apps/ai-gateway-service/evidence/phase-303a-305a-ui-ready-approved-local-operation-loop.md",
];

export const LOCAL_OPERATION_LOOP_DEFAULTS = {
  dryRun: true,
  maxRounds: 3,
  fullOpenEnabled: false,
  autoCommit: false,
  autoPush: false,
  releaseOrDeploy: false,
};

export async function runLocalOperationLoop(request = {}) {
  const action = normalizeAction(request.action);

  if (action === "propose") {
    return proposeLocalOperation(request);
  }

  if (action === "apply-approved") {
    return applyApprovedLocalOperation(request);
  }

  if (action === "auto-review") {
    return autoReviewLocalOperation(request);
  }

  return previewLocalOperation(request);
}

export function previewLocalOperation(request = {}) {
  const input = String(request.input ?? "");
  const allowedFiles = Array.isArray(request.allowedFiles) ? request.allowedFiles : [];
  const intentPreview = createLocalAgentIntentPreview(input);
  const intentExplanation = createLocalAgentIntentExplainer(input, { allowedFiles });
  const approvalRecord = createLocalOperationApprovalRecord({
    input,
    allowedFiles,
    intentType: intentExplanation.classification.intentType,
    riskLevel: intentExplanation.classification.riskLevel,
    permissionMode: request.permissionMode ?? intentExplanation.classification.recommendedPermissionMode,
    status: "draft",
    dryRun: true,
  });
  const blockers = Array.from(new Set([
    ...(intentExplanation.classification.blocked ? intentExplanation.classification.reasons : []),
    ...(approvalRecord.blockers ?? []),
  ]));

  return buildLocalOperationResult({
    operationId: approvalRecord.operationId,
    status: blockers.length ? "blocked" : "preview-ready",
    intentPreview: {
      ...intentPreview,
      explanation: intentExplanation.explanation,
      approvalPreview: intentExplanation.approvalPreview,
      executionPreview: {
        ...intentExplanation.executionPreview,
        willWriteFiles: false,
        willApplyPatch: false,
        willRunCommands: false,
        willCallExternalProvider: false,
        willCommitOrPush: false,
      },
    },
    approvalRecord,
    blockers,
    warnings: [
      ...(intentExplanation.nextStepAdvice ?? []),
      ...(approvalRecord.warnings ?? []),
    ],
    nextSteps: [
      "Choose manual or auto_review permission mode.",
      "Fill allowedFiles explicitly before generating a patch proposal.",
      "Keep dryRun=true until the user explicitly approves apply.",
    ],
  });
}

export function proposeLocalOperation(request = {}) {
  const input = String(request.input ?? "");
  const allowedFiles = Array.isArray(request.allowedFiles) ? request.allowedFiles : [];
  const intentPreview = createLocalAgentIntentPreview(input);
  const intentExplanation = createLocalAgentIntentExplainer(input, { allowedFiles });
  const approvalRecord = createLocalOperationApprovalRecord({
    input,
    allowedFiles,
    intentType: intentExplanation.classification.intentType,
    riskLevel: intentExplanation.classification.riskLevel,
    permissionMode: request.permissionMode ?? intentExplanation.classification.recommendedPermissionMode,
    status: "draft",
    dryRun: true,
  });
  const patchProposal = createLocalOperationPatchProposal({
    operationId: approvalRecord.operationId,
    input,
    allowedFiles,
    proposedChanges: request.proposedChanges ?? request.patchOperations,
    classification: intentExplanation.classification,
  });
  const blockers = Array.from(new Set([
    ...(approvalRecord.blockers ?? []),
    ...(patchProposal.blockers ?? []),
  ]));

  return buildLocalOperationResult({
    operationId: approvalRecord.operationId,
    status: blockers.length ? "proposal-blocked" : "proposal-ready",
    intentPreview: {
      ...intentPreview,
      explanation: intentExplanation.explanation,
      approvalPreview: intentExplanation.approvalPreview,
      executionPreview: intentExplanation.executionPreview,
    },
    approvalRecord,
    patchProposal,
    blockers,
    warnings: [
      ...(approvalRecord.warnings ?? []),
      ...(patchProposal.warnings ?? []),
    ],
    nextSteps: patchProposal.readyToApply
      ? [
        "Review the diff preview and rollback manifest expectations.",
        "Create an approved approvalRecord with dryRun=false only after explicit user approval.",
      ]
      : [
        "Provide explicit proposedChanges for each allowed file before apply can be enabled.",
        "Do not apply until the proposal is ready and approved.",
      ],
  });
}

export async function applyApprovedLocalOperation(request = {}) {
  const dryRun = request.dryRun !== false;
  const rawRecord = request.approvalRecord ?? {};
  const patchProposal = request.patchProposal ?? createLocalOperationPatchProposal({
    operationId: request.operationId,
    input: rawRecord.input ?? request.input,
    allowedFiles: rawRecord.allowedFiles,
    proposedChanges: request.proposedChanges ?? request.patchOperations,
  });
  const approvalRecord = {
    ...rawRecord,
    operationId: rawRecord.operationId ?? request.operationId ?? patchProposal.operationId,
    allowedFiles: Array.isArray(rawRecord.allowedFiles) ? rawRecord.allowedFiles : patchProposal.allowedFiles,
    dryRun,
    fullOpenAllowed: false,
    autoCommit: false,
    autoPush: false,
    releaseOrDeploy: false,
    scope: rawRecord.scope ?? "patch",
  };
  const validation = validateLocalOperationApprovalRecord(approvalRecord, { requireApplyGate: true });
  const proposalReady = patchProposal?.readyToApply === true;
  const blockers = Array.from(new Set([
    ...validation.blockers,
    ...(proposalReady ? [] : ["patch-proposal-not-ready"]),
  ]));
  let applyResult = null;

  if (validation.canApply && proposalReady && dryRun === false) {
    applyResult = await runApprovedPatch({
      patchId: approvalRecord.operationId,
      mode: approvalRecord.permissionMode,
      dryRun: false,
      approvalRecord: {
        ...approvalRecord,
        status: "approved",
        scope: approvalRecord.scope ?? "patch",
      },
      allowedFiles: approvalRecord.allowedFiles,
      patchOperations: patchProposal.proposedChanges,
    });
  } else {
    applyResult = {
      mode: approvalRecord.permissionMode ?? "manual",
      dryRun,
      applied: false,
      approvalRequired: approvalRecord.status !== "approved",
      blockedFiles: [],
      changedFiles: [],
      diffPreview: patchProposal?.diffPreview ?? [],
      rollbackManifest: createRollbackManifest({
        patchId: approvalRecord.operationId ?? patchProposal.operationId,
        dryRun: true,
        changedFiles: [],
        snapshots: [],
      }),
      blockers,
    };
  }

  const rollbackManifest = applyResult?.rollbackManifest ?? createRollbackManifest({
    patchId: approvalRecord.operationId ?? patchProposal.operationId,
    dryRun,
    changedFiles: applyResult?.changedFiles ?? [],
    snapshots: [],
  });

  return buildLocalOperationResult({
    operationId: approvalRecord.operationId ?? patchProposal.operationId,
    status: applyResult?.applied === true ? "applied" : "apply-blocked",
    approvalRecord,
    patchProposal,
    applyResult,
    rollbackManifest,
    blockers,
    warnings: validation.warnings,
    nextSteps: applyResult?.applied === true
      ? [
        "Run Auto Review Loop with whitelisted commands only.",
        "Use go/no-go/review-required output before any further human decision.",
      ]
      : [
        "Fix blockers before attempting approved apply.",
        "Keep dryRun=true unless all approval and path gates pass.",
      ],
  });
}

export async function autoReviewLocalOperation(request = {}) {
  const maxRounds = clampMaxRounds(request.maxRounds);
  const reviewResult = await runAutoReviewLoop({
    mode: "auto_review",
    dryRun: request.dryRun !== false,
    maxRounds,
    commands: Array.isArray(request.commands) ? request.commands : [],
    changedFiles: Array.isArray(request.changedFiles) ? request.changedFiles : [],
    evidencePaths: LOCAL_OPERATION_EVIDENCE_PATHS,
    approvalRequired: true,
  });
  const resultStatus = deriveReviewStatus(reviewResult);

  return buildLocalOperationResult({
    operationId: String(request.operationId ?? "phase303a-305a-auto-review"),
    status: resultStatus,
    reviewResult,
    blockers: reviewResult?.reviewResult?.blockers ?? [],
    warnings: reviewResult?.reviewResult?.warnings ?? [],
    nextSteps: reviewResult?.reviewResult?.nextSteps ?? [
      "Review Auto Review Loop output before continuing.",
    ],
  });
}

function buildLocalOperationResult({
  operationId,
  status,
  intentPreview = null,
  approvalRecord = null,
  patchProposal = null,
  applyResult = null,
  reviewResult = null,
  rollbackManifest = null,
  blockers = [],
  warnings = [],
  nextSteps = [],
}) {
  return {
    operationId,
    status,
    intentPreview,
    approvalRecord,
    patchProposal,
    applyResult,
    reviewResult,
    rollbackManifest,
    evidencePaths: LOCAL_OPERATION_EVIDENCE_PATHS,
    blockers: Array.from(new Set(blockers)),
    warnings: Array.from(new Set(warnings)),
    nextSteps,
    safety: {
      dryRunDefault: true,
      fullOpenEnabled: false,
      autoCommit: false,
      autoPush: false,
      releaseOrDeploy: false,
      realCodexExecCalled: false,
      workflowRunnerCalled: false,
      worktreeCreated: false,
    },
  };
}

function normalizeAction(input) {
  const action = String(input ?? "preview").trim();
  return ["preview", "propose", "apply-approved", "auto-review"].includes(action) ? action : "preview";
}

function clampMaxRounds(input) {
  const parsed = Number(input);
  if (!Number.isInteger(parsed)) {
    return LOCAL_OPERATION_LOOP_DEFAULTS.maxRounds;
  }
  return Math.min(LOCAL_OPERATION_LOOP_DEFAULTS.maxRounds, Math.max(1, parsed));
}

function deriveReviewStatus(reviewResult) {
  const result = reviewResult?.reviewResult ?? {};
  const normalized = String(result.status ?? result.decision ?? result.conclusion ?? "").toLowerCase();
  if (normalized.includes("no-go")) {
    return "no-go";
  }
  if (normalized.includes("go")) {
    return "go";
  }
  if (Array.isArray(result.blockers) && result.blockers.length > 0) {
    return "no-go";
  }
  return "review-required";
}
