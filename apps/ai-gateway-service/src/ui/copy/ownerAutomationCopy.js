import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ownerAutomationPhase1884EvidencePath =
  "apps/ai-gateway-service/evidence/phase1884a-create-desktop-spreadsheet-real-action.json";

export const ownerAutomationPhase1885EvidencePath =
  "apps/ai-gateway-service/evidence/phase1885a-owner-os-file-action-result-integration.json";

const repoRoot = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));

function readPhase1884Evidence() {
  try {
    const evidenceText = readFileSync(resolve(repoRoot, ownerAutomationPhase1884EvidencePath), "utf8");
    return JSON.parse(evidenceText);
  } catch {
    return null;
  }
}

function buildOwnerAutomationFileActionResultCopy(evidence = readPhase1884Evidence()) {
  if (!evidence || evidence.desktopSpreadsheetCreated !== true || !evidence.actualCreatedPath) {
    return null;
  }

  const filePath = evidence.actualCreatedPath;
  const fileName = basename(filePath);
  const fileOpenedAttempted = evidence.fileOpenedAttempted === true;
  const noExistingFileOverwritten = evidence.noExistingFileOverwritten === true;

  return Object.freeze({
    title: "小天已经帮你建好桌面表格",
    summaryLine: "任务表已经放到桌面，可以直接打开继续填写。",
    fileName,
    filePath,
    fileNameLine: `文件：${fileName}`,
    filePathLine: `完整路径：${filePath}`,
    fileOpenedAttempted,
    statusLine: fileOpenedAttempted ? "状态：已创建，并已尝试自动打开" : "状态：已创建，未尝试自动打开",
    noExistingFileOverwritten,
    safetyLine: noExistingFileOverwritten
      ? "没有覆盖已有文件，没有读取桌面其他文件"
      : "安全：未确认是否覆盖已有文件，请查看 evidence",
    nextStep: "打开桌面上的表格，继续填写你的任务",
    advancedRecordTitle: "高级记录",
    sourceEvidenceLine: `动作证据：${ownerAutomationPhase1884EvidencePath}`,
    integrationEvidenceLine: `展示证据：${ownerAutomationPhase1885EvidencePath}`,
    bossDailyReportLine: `小天已经帮你建好桌面表格：${fileName}。打开桌面上的表格，继续填写你的任务。`,
    sourceEvidencePath: ownerAutomationPhase1884EvidencePath,
    integrationEvidencePath: ownerAutomationPhase1885EvidencePath,
  });
}

export { buildOwnerAutomationFileActionResultCopy };

export const ownerAutomationFileActionResultCopy = buildOwnerAutomationFileActionResultCopy();
