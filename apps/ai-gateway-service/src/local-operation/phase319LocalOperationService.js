import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLocalAgentIntentExplainer } from "../agent-runner/localAgentIntentExplainer.js";
import {
  checkLocalOperationForbiddenPaths,
  createLocalOperationApprovalRecord,
  LOCAL_OPERATION_FORBIDDEN_PATHS,
  normalizeLocalOperationAllowedFiles,
} from "../agent-runner/localOperationApprovalRecord.js";
import { createLocalOperationPatchProposal } from "../agent-runner/localOperationPatchProposal.js";
import { applyApprovedLocalOperation, previewLocalOperation } from "../agent-runner/localOperationLoop.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));

export function createPhase319LocalOperationService() {
  return {
    async createIntentPreview(input = {}) {
      const request = normalizeRequest(input);
      const explanation = createLocalAgentIntentExplainer(request.input, { allowedFiles: request.allowedFiles });
      return {
        approvalRequired: true,
        localExecutionTriggered: false,
        providerCalled: false,
        ...explanation,
      };
    },
    async createOperationPlan(input = {}) {
      const request = normalizeRequest(input);
      const preview = previewLocalOperation({
        input: request.input,
        allowedFiles: request.allowedFiles,
        permissionMode: request.permissionMode,
      });
      return {
        operationId: preview.operationId,
        status: preview.status,
        approvalRequired: true,
        providerCalled: false,
        localExecutionTriggered: false,
        intentPreview: preview.intentPreview,
        approvalRecord: preview.approvalRecord,
        blockers: preview.blockers,
        warnings: preview.warnings,
        nextSteps: preview.nextSteps,
      };
    },
    async createPatchProposal(input = {}) {
      const request = normalizeRequest(input);
      const proposedChanges = Array.isArray(input.proposedChanges) && input.proposedChanges.length
        ? input.proposedChanges
        : await buildDefaultProposedChanges(request.allowedFiles);
      const approvalRecord = createLocalOperationApprovalRecord({
        input: request.input,
        allowedFiles: request.allowedFiles,
        permissionMode: request.permissionMode,
        scope: "patch",
        status: "draft",
        dryRun: true,
      });
      const patchProposal = createLocalOperationPatchProposal({
        operationId: approvalRecord.operationId,
        input: request.input,
        allowedFiles: request.allowedFiles,
        proposedChanges,
      });
      return {
        operationId: approvalRecord.operationId,
        status: patchProposal.readyToApply ? "proposal-ready" : "proposal-blocked",
        approvalRequired: true,
        localExecutionTriggered: false,
        providerCalled: false,
        approvalRecord,
        patchProposal,
        summary: summarizePatchProposal(patchProposal),
      };
    },
    async applyApproved(input = {}) {
      const approval = input.approval;
      if (!approval || approval.status !== "approved") {
        return {
          status: "approval-required",
          approvalRequired: true,
          providerCalled: false,
          localExecutionTriggered: false,
          blockedReason: "approval-not-approved",
        };
      }

      const approvalRecord = createLocalOperationApprovalRecord({
        operationId: approval.operationId,
        input: input.input || approval.reason,
        intentType: input.intentType,
        riskLevel: input.riskLevel,
        permissionMode: approval.permissionMode || "manual",
        allowedFiles: approval.allowedFiles,
        scope: approval.scope || "patch",
        status: "approved",
        approvedByUser: true,
        approvedAt: approval.approvedAt || new Date().toISOString(),
        dryRun: input.dryRun !== false ? true : false,
      });
      const patchProposal = input.patchProposal ?? createLocalOperationPatchProposal({
        operationId: approval.operationId,
        input: input.input || approval.reason,
        allowedFiles: approval.allowedFiles,
        proposedChanges: input.proposedChanges ?? [],
      });

      return applyApprovedLocalOperation({
        operationId: approval.operationId,
        dryRun: input.dryRun !== false ? true : false,
        approvalRecord,
        patchProposal,
      });
    },
    getForbiddenPaths() {
      return LOCAL_OPERATION_FORBIDDEN_PATHS.slice();
    },
  };
}

function normalizeRequest(input = {}) {
  return {
    input: String(input.input || input.goal || "").trim(),
    allowedFiles: Array.isArray(input.allowedFiles) ? input.allowedFiles : [],
    permissionMode: String(input.permissionMode || "manual").trim(),
  };
}

async function buildDefaultProposedChanges(allowedFiles) {
  const normalizedFiles = normalizeLocalOperationAllowedFiles(allowedFiles);
  if (!checkLocalOperationForbiddenPaths(normalizedFiles).ok) {
    return [];
  }

  const changes = [];
  for (const file of normalizedFiles) {
    const currentContent = await safeReadRepositoryFile(file);
    if (currentContent === null) {
      continue;
    }
    changes.push({
      path: file,
      nextContent: currentContent,
      reason: "phase319a-noop-approved-apply-check",
    });
  }
  return changes;
}

async function safeReadRepositoryFile(path) {
  const normalizedPath = normalizeLocalOperationAllowedFiles([path])[0];
  if (!normalizedPath || !checkLocalOperationForbiddenPaths([normalizedPath]).ok) {
    return null;
  }

  try {
    const [physicalRoot, physicalFile] = await Promise.all([
      realpath(repoRoot),
      realpath(resolve(repoRoot, normalizedPath)),
    ]);
    const physicalRelativePath = relative(physicalRoot, physicalFile).replace(/\\/g, "/");
    if (
      !physicalRelativePath
      || physicalRelativePath === ".."
      || physicalRelativePath.startsWith("../")
      || isAbsolute(physicalRelativePath)
      || physicalRelativePath.toLowerCase() !== normalizedPath.toLowerCase()
      || !checkLocalOperationForbiddenPaths([physicalRelativePath]).ok
    ) {
      return null;
    }
    return await readFile(physicalFile, "utf8");
  } catch {
    return null;
  }
}

function summarizePatchProposal(patchProposal) {
  const changes = Array.isArray(patchProposal?.proposedChanges) ? patchProposal.proposedChanges : [];
  if (!changes.length) {
    return "未生成文件变更，apply 仍保持审批闸门。";
  }
  return `已生成 ${changes.length} 个受限文件变更预案，仍需 approvalId 才能 apply。`;
}
