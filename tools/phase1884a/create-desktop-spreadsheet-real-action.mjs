import { constants } from "node:fs";
import { access, mkdir, open, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import { dirname, extname, isAbsolute, join, normalize, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidencePath = "apps/ai-gateway-service/evidence/phase1884a-create-desktop-spreadsheet-real-action.json";
const previousEvidencePath = "apps/ai-gateway-service/evidence/phase1883a-create-desktop-spreadsheet-dry-run.json";

const ownerExplicitApproval = {
  allowRealDesktopFileCreate: true,
  approvedAction: "create_desktop_spreadsheet",
  approvedTargetDirectory: "desktop",
  approvedFileType: "csv",
  approvedFileName: "小天任务表.csv",
  allowOverwrite: false,
  allowDesktopScan: false,
  allowReadExistingDesktopFiles: false,
  allowOpenAfterCreate: true,
  maxFilesToCreate: 1,
};

const input = {
  action: "create_desktop_spreadsheet",
  fileName: ownerExplicitApproval.approvedFileName,
  targetDirectory: "desktop",
  columns: ["任务", "状态", "备注"],
  rows: [
    ["示例任务", "待处理", "这是小天创建的表格"],
    ["今天要做的事", "待填写", "你可以在这里继续编辑"],
  ],
  openAfterCreate: true,
  overwritePolicy: "never_overwrite_append_timestamp",
};

function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

async function readJson(relativePath) {
  const text = await readFile(repoPath(relativePath), "utf8");
  return JSON.parse(text);
}

async function writeJson(relativePath, data) {
  const absolutePath = repoPath(relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function detectDesktopPath() {
  return join(os.homedir(), "Desktop");
}

function sanitizeCsvFileName(fileName) {
  const trimmed = String(fileName ?? "").trim();
  const cleaned = trimmed.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_");
  if (!cleaned) return "owner-table.csv";
  return /\.csv$/i.test(cleaned) ? cleaned : `${cleaned}.csv`;
}

function timestampForFileName(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function appendTimestamp(fileName, timestamp) {
  return fileName.replace(/\.csv$/i, `-${timestamp}.csv`);
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(columns, rows) {
  return [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function isPathInside(parent, candidate) {
  const normalizedParent = normalize(parent).toLowerCase();
  const normalizedCandidate = normalize(candidate).toLowerCase();
  return normalizedCandidate === normalizedParent || normalizedCandidate.startsWith(`${normalizedParent}\\`);
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function chooseTargetPath(desktopPath, fileName) {
  const targetPath = join(desktopPath, fileName);
  const targetExists = await exists(targetPath);
  if (!targetExists) {
    return {
      targetPath,
      actualCreatedPath: targetPath,
      requestedTargetExisted: false,
      timestampFallbackUsed: false,
      timestampFallbackPath: join(desktopPath, appendTimestamp(fileName, timestampForFileName())),
    };
  }

  const fallbackName = appendTimestamp(fileName, timestampForFileName());
  const fallbackPath = join(desktopPath, fallbackName);
  const fallbackExists = await exists(fallbackPath);
  if (fallbackExists) {
    throw new Error("timestamp_fallback_already_exists");
  }
  return {
    targetPath,
    actualCreatedPath: fallbackPath,
    requestedTargetExisted: true,
    timestampFallbackUsed: true,
    timestampFallbackPath: fallbackPath,
  };
}

async function writeExclusiveUtf8BomCsv(filePath, csvText) {
  const handle = await open(filePath, "wx");
  try {
    await handle.writeFile(`\uFEFF${csvText}`, "utf8");
  } finally {
    await handle.close();
  }
}

function tryOpenFile(filePath) {
  return new Promise((resolveOpen) => {
    if (process.platform !== "win32") {
      resolveOpen({ attempted: false, succeeded: false, skippedReason: "non_windows_platform" });
      return;
    }

    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Start-Process -LiteralPath $args[0]", filePath],
      {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      },
    );

    child.on("error", (error) => {
      resolveOpen({ attempted: true, succeeded: false, error: error.message });
    });
    child.on("spawn", () => {
      child.unref();
      resolveOpen({ attempted: true, succeeded: true, error: null });
    });
  });
}

const actionStartedAt = new Date().toISOString();
const previousEvidence = await readJson(previousEvidencePath);
const desktopPath = detectDesktopPath();
const targetFileName = sanitizeCsvFileName(input.fileName);
const csvText = toCsv(input.columns, input.rows);
const expectedCsv = [
  "任务,状态,备注",
  "示例任务,待处理,这是小天创建的表格",
  "今天要做的事,待填写,你可以在这里继续编辑",
].join("\r\n");

const previousPhaseReady =
  previousEvidence.completed === true &&
  previousEvidence.recommended_sealed === true &&
  previousEvidence.blocker === null &&
  previousEvidence.csvDryRunImplemented === true &&
  previousEvidence.desktopPathDetected === true &&
  previousEvidence.safePathCheckPassed === true &&
  previousEvidence.csvPreviewGenerated === true &&
  previousEvidence.headersValid === true &&
  previousEvidence.chineseContentValid === true &&
  previousEvidence.wouldCreateFile === true &&
  previousEvidence.realFileCreated === false &&
  previousEvidence.noExistingFileWouldBeOverwritten === true;

const approvalValid =
  ownerExplicitApproval.allowRealDesktopFileCreate === true &&
  ownerExplicitApproval.approvedAction === input.action &&
  ownerExplicitApproval.approvedTargetDirectory === input.targetDirectory &&
  ownerExplicitApproval.approvedFileType === "csv" &&
  ownerExplicitApproval.approvedFileName === input.fileName &&
  ownerExplicitApproval.allowOverwrite === false &&
  ownerExplicitApproval.allowDesktopScan === false &&
  ownerExplicitApproval.allowReadExistingDesktopFiles === false &&
  ownerExplicitApproval.maxFilesToCreate === 1;

let result = {
  phase: "Phase1884A",
  routeChoice: "Route A / local_self_use_only",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  ownerExplicitApproval,
  previousPhaseReady,
  approvalValid,
  action: input.action,
  input,
  actionStartedAt,
  desktopPathDetected: Boolean(desktopPath),
  desktopPath,
  targetFileName,
  targetPath: null,
  requestedTargetExisted: null,
  timestampFallbackUsed: null,
  timestampFallbackPath: null,
  actualCreatedPath: null,
  filesCreatedCount: 0,
  desktopSpreadsheetCreated: false,
  fileCreated: false,
  createdFileExists: false,
  createdFilePathOnDesktop: false,
  createdFileExtension: "csv",
  fileSizeBytes: 0,
  utf8BomWritten: false,
  csvContentPreview: csvText,
  csvHeadersValid: csvText.split(/\r?\n/)[0] === "任务,状态,备注",
  spreadsheetHeadersValid: false,
  chineseContentValid: csvText === expectedCsv,
  spreadsheetChineseContentValid: false,
  noExistingFileOverwritten: false,
  allowOverwrite: ownerExplicitApproval.allowOverwrite,
  targetExistenceChecked: false,
  desktopScanPerformed: false,
  readExistingDesktopFiles: false,
  deletedFiles: false,
  movedFiles: false,
  uploadedFiles: false,
  networkUsed: false,
  allowOpenAfterCreate: ownerExplicitApproval.allowOpenAfterCreate,
  fileOpenedAttempted: false,
  fileOpened: false,
  fileOpenError: null,
  providerCallsMade: false,
  rawSecretRead: false,
  authJsonRead: false,
  rawCredentialRefRead: false,
  legacyModified: false,
  legacyScriptsExecuted: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  workspaceCleanClaimed: false,
  evidencePath,
};

try {
  if (!previousPhaseReady) throw new Error("previous_phase_not_ready");
  if (!approvalValid) throw new Error("owner_approval_not_valid");
  if (!isAbsolute(desktopPath)) throw new Error("desktop_path_not_absolute");
  if (!isPathInside(desktopPath, join(desktopPath, targetFileName))) throw new Error("target_path_outside_desktop");
  if (extname(targetFileName).toLowerCase() !== ".csv") throw new Error("target_file_not_csv");
  if (csvText !== expectedCsv) throw new Error("csv_content_invalid");

  const target = await chooseTargetPath(desktopPath, targetFileName);
  result = {
    ...result,
    targetPath: target.targetPath,
    actualCreatedPath: target.actualCreatedPath,
    requestedTargetExisted: target.requestedTargetExisted,
    timestampFallbackUsed: target.timestampFallbackUsed,
    timestampFallbackPath: target.timestampFallbackPath,
    targetExistenceChecked: true,
  };

  if (!isPathInside(desktopPath, target.actualCreatedPath)) throw new Error("actual_target_path_outside_desktop");
  await writeExclusiveUtf8BomCsv(target.actualCreatedPath, csvText);

  const createdStat = await stat(target.actualCreatedPath);
  const createdBuffer = await readFile(target.actualCreatedPath);
  const createdText = createdBuffer.toString("utf8").replace(/^\uFEFF/, "");
  const openResult =
    ownerExplicitApproval.allowOpenAfterCreate && input.openAfterCreate
      ? await tryOpenFile(target.actualCreatedPath)
      : { attempted: false, succeeded: false, skippedReason: "open_after_create_not_allowed" };

  result = {
    ...result,
    filesCreatedCount: 1,
    desktopSpreadsheetCreated: true,
    fileCreated: true,
    createdFileExists: true,
    createdFilePathOnDesktop: isPathInside(desktopPath, target.actualCreatedPath),
    createdFileExtension: extname(target.actualCreatedPath).replace(/^\./, "").toLowerCase(),
    fileSizeBytes: createdStat.size,
    utf8BomWritten: createdBuffer.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])),
    spreadsheetHeadersValid: createdText.split(/\r?\n/)[0] === "任务,状态,备注",
    spreadsheetChineseContentValid: createdText === expectedCsv,
    noExistingFileOverwritten: true,
    fileOpenedAttempted: openResult.attempted,
    fileOpened: openResult.succeeded,
    fileOpenError: openResult.error ?? null,
    fileOpenSkippedReason: openResult.skippedReason ?? null,
  };
} catch (error) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = error instanceof Error ? error.message : String(error);
}

result.actionFinishedAt = new Date().toISOString();

await writeJson(evidencePath, result);
console.log(JSON.stringify(result, null, 2));

if (result.completed !== true || result.recommended_sealed !== true || result.blocker) {
  process.exitCode = 1;
}
