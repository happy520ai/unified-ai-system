import { realRun as createOneRealRun, dryRun as createOneDryRun } from "./createDesktopSpreadsheet.js";
import { createOwnerAutomationError, validateBatchApproval } from "../desktopActionSafety.js";

export const BATCH_CREATE_DESKTOP_SPREADSHEETS_ACTION_ID = "batch_create_desktop_spreadsheets";
export const DEFAULT_MAX_BATCH_COUNT = 3;
export const HARD_MAX_BATCH_COUNT = 5;

export function dryRun(input = {}) {
  const items = normalizeItems(input.items);
  assertBatchCount(items.length);
  const previews = items.map((item) => createOneDryRun(item));
  return {
    actionId: BATCH_CREATE_DESKTOP_SPREADSHEETS_ACTION_ID,
    dryRun: true,
    realRunDefaultBlocked: true,
    maxBatchCount: DEFAULT_MAX_BATCH_COUNT,
    hardMaxBatchCount: HARD_MAX_BATCH_COUNT,
    desktopFileCreated: false,
    desktopScanPerformed: false,
    desktopOtherFilesRead: false,
    bulkDeleteMoveOverwriteCapability: false,
    providerCallsMade: false,
    items: previews,
  };
}

export async function realRun(input = {}, approval, options = {}) {
  const items = normalizeItems(input.items).slice(0, DEFAULT_MAX_BATCH_COUNT);
  assertBatchCount(items.length);
  validateBatchApproval({
    approval,
    phase: options.approvalPhase,
    actionId: BATCH_CREATE_DESKTOP_SPREADSHEETS_ACTION_ID,
    requestedCount: items.length,
  });

  const created = [];
  for (const item of items) {
    created.push(await createOneRealRun(item, {
      ...approval,
      approvedActionId: "create_desktop_spreadsheet",
      maxRealFileCreateCount: 1,
      acknowledgeThisCreatesARealDesktopFile: true,
    }));
  }

  return {
    actionId: BATCH_CREATE_DESKTOP_SPREADSHEETS_ACTION_ID,
    dryRun: false,
    approvalRequired: true,
    approvalAccepted: true,
    fileCreated: created.length > 0,
    desktopFileCreated: created.length > 0,
    desktopFileCreatedCount: created.length,
    createdFiles: created,
    overwriteDetected: false,
    desktopScanPerformed: false,
    desktopOtherFilesRead: false,
    providerCallsMade: false,
    secretValueExposed: false,
  };
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw createOwnerAutomationError("batch_items_required", "Batch create requires explicit items.");
  }
  return items.map((item) => ({
    filenamePrefix: item.filenamePrefix ?? item.fileName ?? item.filename,
    fileType: item.fileType ?? "csv",
    headers: item.headers,
    rows: item.rows,
  }));
}

function assertBatchCount(count) {
  if (!Number.isInteger(count) || count < 1) {
    throw createOwnerAutomationError("batch_items_required", "Batch create requires at least one item.");
  }
  if (count > DEFAULT_MAX_BATCH_COUNT) {
    throw createOwnerAutomationError("batch_count_exceeds_default_max", "Batch dry-run is limited to 3 items by default.");
  }
  if (count > HARD_MAX_BATCH_COUNT) {
    throw createOwnerAutomationError("batch_count_exceeds_hard_max", "Batch hard max is 5 items.");
  }
}
