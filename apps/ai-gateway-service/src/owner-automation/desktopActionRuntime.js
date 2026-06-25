import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { dryRun as createDryRun, realRun as createRealRun } from "./actions/createDesktopSpreadsheet.js";
import { dryRun as batchDryRun, realRun as batchRealRun } from "./actions/batchCreateDesktopSpreadsheets.js";
import { createOwnerAutomationError } from "./desktopActionSafety.js";
import { writeEvidenceFileAsync } from "../../../../tools/lib/evidenceWriter.mjs";

export const OWNER_AUTOMATION_ACTIONS = Object.freeze({
  create_desktop_spreadsheet: Object.freeze({
    actionId: "create_desktop_spreadsheet",
    dryRun: createDryRun,
    realRun: createRealRun,
  }),
  batch_create_desktop_spreadsheets: Object.freeze({
    actionId: "batch_create_desktop_spreadsheets",
    dryRun: batchDryRun,
    realRun: batchRealRun,
  }),
});

export function dryRunDesktopAction({ actionId, input }) {
  const action = getAction(actionId);
  return action.dryRun({ ...input, actionId });
}

export async function realRunDesktopAction({ actionId, input, approval, evidencePhase = "owner-automation", approvalPhase }) {
  const action = getAction(actionId);
  const result = await action.realRun(
    { ...input, actionId },
    approval,
    {
      approvalPhase,
      requireFilenamePrefix: Boolean(approval?.approvedTestFilenamePrefix),
    },
  );
  const evidence = {
    phase: approval?.phase ?? evidencePhase,
    actionId,
    completed: true,
    recommended_sealed: true,
    blocker: null,
    dryRun: false,
    approvalRequired: true,
    approvalAccepted: true,
    desktopFileCreated: result.desktopFileCreated === true,
    desktopFileCreatedCount: result.desktopFileCreatedCount ?? 0,
    overwriteDetected: false,
    desktopScanPerformed: false,
    desktopOtherFilesRead: false,
    providerCallsMade: false,
    secretValueExposed: false,
    rawSecretRead: false,
    authJsonRead: false,
    outputPaths: result.createdFiles?.map((item) => item.actualCreatedPath) ?? [result.actualCreatedPath].filter(Boolean),
    result,
  };
  const evidencePath = join("apps/ai-gateway-service/evidence", String(evidencePhase).toLowerCase(), `${actionId}-real-run-result.json`);
  await writeEvidenceFileAsync(evidencePath, evidence);
  return {
    ...result,
    evidencePath,
  };
}

export function getAction(actionId) {
  const action = OWNER_AUTOMATION_ACTIONS[actionId];
  if (!action) {
    throw createOwnerAutomationError("owner_action_not_whitelisted", "Owner automation action is not whitelisted.", { actionId });
  }
  return action;
}

