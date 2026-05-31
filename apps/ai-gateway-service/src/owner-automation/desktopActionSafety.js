import os from "node:os";
import { isAbsolute, join, normalize } from "node:path";

export function getDesktopDirectory() {
  return join(os.homedir(), "Desktop");
}

export function sanitizeFileNamePart(value, fallback = "owner-table") {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return cleaned || fallback;
}

export function timestampForFileName(date = new Date()) {
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function isPathInside(parent, candidate) {
  const normalizedParent = normalize(parent).toLowerCase();
  const normalizedCandidate = normalize(candidate).toLowerCase();
  return normalizedCandidate === normalizedParent || normalizedCandidate.startsWith(`${normalizedParent}\\`);
}

export function assertDesktopPath(path) {
  const desktop = getDesktopDirectory();
  if (!isAbsolute(path) || !isPathInside(desktop, path)) {
    const error = new Error("output_path_must_be_inside_desktop");
    error.code = "output_path_must_be_inside_desktop";
    throw error;
  }
  return true;
}

export function createOwnerAutomationError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.category = "owner_automation";
  error.details = details;
  return error;
}

export function validateSingleApproval({ approval, phase, actionId, filenamePrefix }) {
  if (!approval || typeof approval !== "object") {
    throw createOwnerAutomationError("owner_approval_required", "Owner approval input is required for real desktop file creation.");
  }
  if (phase && approval.phase !== phase) {
    throw createOwnerAutomationError("approval_phase_mismatch", "Owner approval phase does not match the requested action.");
  }
  if (approval.ownerApproved !== true || approval.approvedActionId !== actionId) {
    throw createOwnerAutomationError("owner_approval_required", "Owner approval does not authorize this action.");
  }
  if (approval.allowRealDesktopFileCreation !== true) {
    throw createOwnerAutomationError("real_desktop_file_creation_not_allowed", "Owner approval does not allow real desktop file creation.");
  }
  if (approval.allowOverwrite !== false) {
    throw createOwnerAutomationError("overwrite_forbidden", "Overwrite must remain false for owner desktop automation.");
  }
  if (approval.allowDesktopScan !== false) {
    throw createOwnerAutomationError("desktop_scan_forbidden", "Desktop scan must remain false for owner desktop automation.");
  }
  if (approval.allowReadOtherDesktopFiles !== false) {
    throw createOwnerAutomationError("read_other_desktop_files_forbidden", "Reading other Desktop files must remain false.");
  }
  if (approval.approvedOutputDirectory !== "Desktop") {
    throw createOwnerAutomationError("desktop_output_required", "Approved output directory must be Desktop.");
  }
  if (approval.maxRealFileCreateCount !== 1) {
    throw createOwnerAutomationError("max_file_count_invalid", "Single real run approval must allow exactly one file.");
  }
  if (filenamePrefix && approval.approvedTestFilenamePrefix && approval.approvedTestFilenamePrefix !== filenamePrefix) {
    throw createOwnerAutomationError("approved_filename_prefix_mismatch", "Filename prefix does not match owner approval.");
  }
  return true;
}

export function validateBatchApproval({ approval, phase, actionId, requestedCount }) {
  if (!approval || typeof approval !== "object") {
    throw createOwnerAutomationError("owner_approval_required", "Owner approval input is required for batch desktop file creation.");
  }
  if (phase && approval.phase !== phase) {
    throw createOwnerAutomationError("approval_phase_mismatch", "Owner approval phase does not match the requested batch action.");
  }
  if (approval.ownerApproved !== true || approval.approvedActionId !== actionId) {
    throw createOwnerAutomationError("owner_approval_required", "Owner approval does not authorize this batch action.");
  }
  if (approval.allowRealDesktopFileCreation !== true) {
    throw createOwnerAutomationError("real_desktop_file_creation_not_allowed", "Owner approval does not allow real desktop file creation.");
  }
  if (approval.allowOverwrite !== false) throw createOwnerAutomationError("overwrite_forbidden", "Overwrite is forbidden.");
  if (approval.allowDesktopScan !== false) throw createOwnerAutomationError("desktop_scan_forbidden", "Desktop scan is forbidden.");
  if (approval.allowReadOtherDesktopFiles !== false) {
    throw createOwnerAutomationError("read_other_desktop_files_forbidden", "Reading other Desktop files is forbidden.");
  }
  if (approval.approvedOutputDirectory !== "Desktop") {
    throw createOwnerAutomationError("desktop_output_required", "Approved output directory must be Desktop.");
  }
  if (!Number.isInteger(approval.maxRealFileCreateCount) || approval.maxRealFileCreateCount < 2 || approval.maxRealFileCreateCount > 3) {
    throw createOwnerAutomationError("batch_max_file_count_invalid", "Batch approval must allow between 2 and 3 files for this seal.");
  }
  if (requestedCount > approval.maxRealFileCreateCount) {
    throw createOwnerAutomationError("batch_count_exceeds_approval", "Requested batch count exceeds owner approval.");
  }
  return true;
}
