import { classifyLocalAgentIntent } from "./localAgentIntentClassifier.js";
import {
  buildLocalOperationId,
  checkLocalOperationForbiddenPaths,
  normalizeLocalOperationAllowedFiles,
} from "./localOperationApprovalRecord.js";

export function createLocalOperationPatchProposal(request = {}) {
  const input = String(request.input ?? "");
  const classification = request.classification ?? classifyLocalAgentIntent(input);
  const operationId = String(request.operationId || buildLocalOperationId(input, request.allowedFiles));
  const allowedFiles = normalizeLocalOperationAllowedFiles(request.allowedFiles);
  const proposedChanges = normalizeProposedChanges(request.proposedChanges ?? request.patchOperations);
  const changedPaths = normalizeLocalOperationAllowedFiles(proposedChanges.map((change) => change.path));
  const forbiddenPathCheck = checkLocalOperationForbiddenPaths([...allowedFiles, ...changedPaths]);
  const blockers = buildProposalBlockers({
    classification,
    allowedFiles,
    proposedChanges,
    forbiddenPathCheck,
  });
  const readyToApply = blockers.length === 0;

  return {
    operationId,
    allowedFiles,
    proposedChanges,
    diffPreview: buildDiffPreview({ proposedChanges, blockers, allowedFiles }),
    forbiddenPathCheck,
    approvalRequired: true,
    readyToApply,
    blockers,
    warnings: buildProposalWarnings({ proposedChanges, readyToApply }),
  };
}

function normalizeProposedChanges(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((change) => ({
      path: normalizeProposalPath(change?.path),
      hasNextContent: typeof change?.nextContent === "string",
      nextContent: typeof change?.nextContent === "string" ? change.nextContent : "",
      reason: typeof change?.reason === "string" ? change.reason.trim() : "approved-local-operation-proposal",
    }))
    .filter((change) => change.path);
}

function buildProposalBlockers({ classification, allowedFiles, proposedChanges, forbiddenPathCheck }) {
  const blockers = [];

  if (classification.blocked) {
    blockers.push("blocked-intent-cannot-propose-apply");
  }

  if (allowedFiles.length === 0) {
    blockers.push("allowed-files-required");
  }

  if (!forbiddenPathCheck.ok) {
    blockers.push("forbidden-paths-blocked");
  }

  if (proposedChanges.length === 0) {
    blockers.push("explicit-proposed-changes-required");
  }

  for (const change of proposedChanges) {
    if (!allowedFiles.includes(change.path)) {
      blockers.push(`path-not-in-allowedFiles:${change.path}`);
    }
    if (change.hasNextContent !== true) {
      blockers.push(`next-content-required:${change.path}`);
    }
  }

  return Array.from(new Set(blockers));
}

function buildProposalWarnings({ proposedChanges, readyToApply }) {
  const warnings = [
    "proposal-only-no-file-write",
    "approval-record-required-before-apply",
  ];

  if (!proposedChanges.length) {
    warnings.push("no-generated-patch-content");
  }

  if (!readyToApply) {
    warnings.push("not-ready-to-apply");
  }

  return warnings;
}

function buildDiffPreview({ proposedChanges, blockers, allowedFiles }) {
  if (!proposedChanges.length) {
    return [{
      path: allowedFiles[0] ?? "n/a",
      preview: [
        "--- no-change",
        "+++ no-change",
        "@@ explicit proposedChanges required before apply",
        "# No file content is generated or written by this proposal.",
      ].join("\n"),
      proposedLength: 0,
      blockers,
    }];
  }

  return proposedChanges.map((change) => ({
    path: change.path,
    reason: change.reason,
    proposedLength: change.nextContent.length,
    preview: [
      `--- ${change.path}`,
      `+++ ${change.path}`,
      `@@ proposedLength=${change.nextContent.length}`,
      "# diff preview intentionally omits raw content; apply remains gated by approval.",
    ].join("\n"),
  }));
}

function normalizeProposalPath(input) {
  return String(input ?? "")
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .trim();
}
