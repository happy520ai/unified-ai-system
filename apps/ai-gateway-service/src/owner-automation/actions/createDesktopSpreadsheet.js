import { constants } from "node:fs";
import { access, mkdir, open, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import ExcelJS from "exceljs";
import {
  assertDesktopPath,
  getDesktopDirectory,
  sanitizeFileNamePart,
  timestampForFileName,
  validateSingleApproval,
} from "../desktopActionSafety.js";

export const CREATE_DESKTOP_SPREADSHEET_ACTION_ID = "create_desktop_spreadsheet";

export function dryRun(input = {}) {
  const normalized = normalizeInput(input);
  const fileName = buildFileName(normalized.filenamePrefix, normalized.fileType);
  const outputPath = join(getDesktopDirectory(), fileName);
  assertDesktopPath(outputPath);

  return {
    actionId: CREATE_DESKTOP_SPREADSHEET_ACTION_ID,
    dryRun: true,
    outputDirectory: "Desktop",
    fileName,
    outputPathPreview: outputPath,
    outputPathPreviewInsideDesktop: true,
    timestampAppended: true,
    neverOverwrite: true,
    desktopScanPerformed: false,
    desktopOtherFilesRead: false,
    deleteMoveOverwriteCapability: false,
    providerCallsMade: false,
    headers: normalized.headers,
    rows: normalized.rows,
    csvPreview: toCsv(normalized.headers, normalized.rows),
  };
}

export async function realRun(input = {}, approval, options = {}) {
  const normalized = normalizeInput(input);
  validateSingleApproval({
    approval,
    phase: options.approvalPhase,
    actionId: CREATE_DESKTOP_SPREADSHEET_ACTION_ID,
    filenamePrefix: options.requireFilenamePrefix ? normalized.filenamePrefix : undefined,
  });
  const preview = dryRun(normalized);
  const outputPath = preview.outputPathPreview;
  await mkdir(dirname(outputPath), { recursive: true });
  await assertDoesNotExist(outputPath);

  const fileBuffer = normalized.fileType === "xlsx"
    ? await toXlsxBuffer(normalized.headers, normalized.rows)
    : Buffer.from(`\uFEFF${toCsv(normalized.headers, normalized.rows)}`, "utf8");
  const handle = await open(outputPath, "wx");
  try {
    await handle.writeFile(fileBuffer);
  } finally {
    await handle.close();
  }
  const fileStat = await stat(outputPath);

  return {
    ...preview,
    dryRun: false,
    approvalRequired: true,
    approvalAccepted: true,
    fileCreated: true,
    desktopFileCreated: true,
    desktopFileCreatedCount: 1,
    outputPath,
    actualCreatedPath: outputPath,
    fileSizeBytes: fileStat.size,
    overwriteDetected: false,
    desktopScanPerformed: false,
    desktopOtherFilesRead: false,
    providerCallsMade: false,
    secretValueExposed: false,
  };
}

export { writeEvidenceFileAsync as writeEvidence } from "../../../../tools/lib/evidenceWriter.mjs";

function normalizeInput(input = {}) {
  const headers = Array.isArray(input.headers) && input.headers.length > 0 ? input.headers.map(String) : ["任务", "状态", "备注"];
  const rows = Array.isArray(input.rows) && input.rows.length > 0
    ? input.rows.map((row) => (Array.isArray(row) ? row.map(String) : [String(row)]))
    : [["示例任务", "待处理", "由小天创建"]];
  return {
    actionId: CREATE_DESKTOP_SPREADSHEET_ACTION_ID,
    filenamePrefix: sanitizeFileNamePart(input.filenamePrefix ?? input.fileName ?? input.filename ?? "小天真实运行测试"),
    fileType: normalizeFileType(input.fileType),
    headers,
    rows,
  };
}

function normalizeFileType(fileType) {
  const value = String(fileType ?? "csv").toLowerCase();
  return value === "xlsx" ? "xlsx" : "csv";
}

function buildFileName(prefix, fileType) {
  const extension = fileType === "xlsx" ? "xlsx" : "csv";
  return `${sanitizeFileNamePart(prefix)}-${timestampForFileName()}.${extension}`;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/u.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(headers, rows) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

async function toXlsxBuffer(headers, rows) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sheet1");
  worksheet.addRow(headers);
  for (const row of rows) {
    worksheet.addRow(row);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function assertDoesNotExist(path) {
  try {
    await access(path, constants.F_OK);
  } catch {
    return true;
  }
  const error = new Error("target_file_already_exists");
  error.code = "target_file_already_exists";
  throw error;
}
