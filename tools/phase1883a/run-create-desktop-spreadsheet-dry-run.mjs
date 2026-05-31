import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidencePath = "apps/ai-gateway-service/evidence/phase1883a-create-desktop-spreadsheet-dry-run.json";
const previousEvidencePath = "apps/ai-gateway-service/evidence/phase1882a-owner-automation-contract.json";
const contractPath = "docs/automation/create-desktop-spreadsheet-action-contract.json";

const input = {
  action: "create_desktop_spreadsheet",
  fileName: "小天任务表.csv",
  targetDirectory: "desktop",
  columns: ["任务", "状态", "备注"],
  rows: [
    ["示例任务", "待处理", "这是小天创建的表格"],
    ["今天要做的事", "待填写", "你可以在这里继续编辑"],
  ],
  openAfterCreate: true,
  overwritePolicy: "never_overwrite_append_timestamp",
  dryRun: true,
};

function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

async function readJson(relativePath) {
  const text = await readFile(repoPath(relativePath), "utf8");
  return JSON.parse(text);
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
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
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

function toCsvPreview(columns, rows) {
  return [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function isPathInside(parent, candidate) {
  const normalizedParent = normalize(parent).toLowerCase();
  const normalizedCandidate = normalize(candidate).toLowerCase();
  return normalizedCandidate === normalizedParent || normalizedCandidate.startsWith(`${normalizedParent}\\`);
}

function safeTargetPath(desktopPath, fileName) {
  const target = join(desktopPath, fileName);
  return {
    target,
    passed: isAbsolute(target) && isPathInside(desktopPath, target),
  };
}

async function writeJson(relativePath, data) {
  const absolutePath = repoPath(relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

const previousEvidence = await readJson(previousEvidencePath);
const contract = await readJson(contractPath);
const desktopPath = detectDesktopPath();
const targetFileName = sanitizeCsvFileName(input.fileName);
const { target: targetPathPreview, passed: safePathCheckPassed } = safeTargetPath(desktopPath, targetFileName);
const timestampFallbackFileName = appendTimestamp(targetFileName, timestampForFileName());
const timestampFallbackPreview = join(desktopPath, timestampFallbackFileName);
const csvPreview = toCsvPreview(input.columns, input.rows);
const expectedHeader = "任务,状态,备注";
const chineseSamples = [
  "示例任务",
  "待处理",
  "这是小天创建的表格",
  "今天要做的事",
  "待填写",
  "你可以在这里继续编辑",
];

const previousPhaseReady =
  previousEvidence.completed === true &&
  previousEvidence.recommended_sealed === true &&
  previousEvidence.blocker === null &&
  previousEvidence.ownerAutomationKernelContractReady === true &&
  previousEvidence.createDesktopSpreadsheetContractReady === true &&
  previousEvidence.safeLocalFileActionPolicyReady === true &&
  previousEvidence.overwriteProtectionDefined === true;

const contractReady =
  contract.phase === "Phase1882A" &&
  contract.action === "create_desktop_spreadsheet" &&
  contract.inputSchema?.properties?.overwritePolicy?.default === "never_overwrite_append_timestamp";

const result = {
  phase: "Phase1883A",
  routeChoice: "Route A / local_self_use_only",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  previousPhaseReady,
  contractReady,
  ok: true,
  dryRun: true,
  csvDryRunImplemented: true,
  action: input.action,
  input,
  desktopPathDetected: Boolean(desktopPath),
  desktopPath,
  desktopPathScanPerformed: false,
  desktopOtherFilesRead: false,
  exactDesktopTargetExistenceChecked: false,
  targetFileName,
  targetPathPreview,
  safePathCheckPassed,
  wouldCreateFile: true,
  realFileCreated: false,
  fileWriteAttempted: false,
  wouldOpenAfterCreate: input.openAfterCreate === true,
  realFileOpened: false,
  excelOrWpsOpened: false,
  csvPreviewGenerated: true,
  csvPreview,
  headersValid: csvPreview.split(/\r?\n/)[0] === expectedHeader,
  chineseContentValid: chineseSamples.every((sample) => csvPreview.includes(sample)) && !csvPreview.includes("�"),
  noExistingFileWouldBeOverwritten: true,
  overwritePolicy: input.overwritePolicy,
  timestampFallbackFileName,
  timestampFallbackPreview,
  wouldCreateEvidence: true,
  evidenceGenerated: true,
  evidencePath,
  actionContractPath: contractPath,
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
  notes: [
    "Phase1883A writes only this evidence JSON.",
    "No Desktop file is created or opened.",
    "No Desktop directory scan or unrelated Desktop file read is performed.",
  ],
};

if (!previousPhaseReady || !contractReady || !safePathCheckPassed || !result.headersValid || !result.chineseContentValid) {
  const failed = [];
  if (!previousPhaseReady) failed.push("previous_phase_not_ready");
  if (!contractReady) failed.push("contract_not_ready");
  if (!safePathCheckPassed) failed.push("safe_path_check_failed");
  if (!result.headersValid) failed.push("headers_invalid");
  if (!result.chineseContentValid) failed.push("chinese_content_invalid");
  result.completed = false;
  result.recommended_sealed = false;
  result.ok = false;
  result.blocker = `phase1883a_dry_run_failed:${failed.join(",")}`;
}

await writeJson(evidencePath, result);
console.log(JSON.stringify(result, null, 2));

if (result.completed !== true || result.recommended_sealed !== true || result.blocker) {
  process.exitCode = 1;
}
