import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ownerAutomationCommandRegistryPath = "docs/automation/registered-owner-actions.json";
export const ownerAutomationCommandSchemaPath = "docs/automation/owner-automation-action-registry.schema.json";
export const createDesktopSpreadsheetContractPath =
  "docs/automation/create-desktop-spreadsheet-action-contract.json";
export const createDesktopSpreadsheetDryRunEvidencePath =
  "apps/ai-gateway-service/evidence/phase1883a-create-desktop-spreadsheet-dry-run.json";
export const ownerAutomationCommandEvidencePath =
  "apps/ai-gateway-service/evidence/phase1891a-owner-automation-command-palette-v1.json";
export const ownerAutomationCommandV1SealEvidencePath =
  "apps/ai-gateway-service/evidence/phase1900a-command-palette-v1-seal.json";
export const ownerAutomationDryRunPreviewDrawerEvidencePath =
  "apps/ai-gateway-service/evidence/phase1901a-command-palette-dry-run-preview-drawer-polish.json";
export const ownerAutomationRealRunApprovalPath =
  "docs/approvals/phase1905a-owner-desktop-real-run.input.json";
export const ownerAutomationBatchApprovalPath =
  "docs/approvals/phase1908a-owner-batch-desktop-real-run.input.json";

const repoRoot = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));

function hasValidPhase1905Approval() {
  try {
    const approval = JSON.parse(readFileSync(resolve(repoRoot, ownerAutomationRealRunApprovalPath), "utf8"));
    return approval.phase === "Phase1905A" &&
      approval.ownerApproved === true &&
      approval.approvedActionId === "create_desktop_spreadsheet" &&
      approval.allowRealDesktopFileCreation === true &&
      approval.maxRealFileCreateCount === 1 &&
      approval.allowOverwrite === false &&
      approval.allowDesktopScan === false &&
      approval.allowReadOtherDesktopFiles === false &&
      approval.approvedOutputDirectory === "Desktop" &&
      approval.acknowledgeThisCreatesARealDesktopFile === true;
  } catch {
    return false;
  }
}

const commandFallback = Object.freeze({
  actionId: "create_desktop_spreadsheet",
  displayName: "创建桌面表格",
  ownerFacingName: "帮我在桌面建一个表格",
  description: "在桌面创建一个 CSV 任务表，并尝试自动打开。",
  realRunRequiresApproval: true,
  defaultDryRunFirst: true,
  overwritePolicy: "never_overwrite_append_timestamp",
  evidenceRefs: {
    dryRun: "apps/ai-gateway-service/evidence/phase1883a-create-desktop-spreadsheet-dry-run.json",
    realRun: "apps/ai-gateway-service/evidence/phase1884a-create-desktop-spreadsheet-real-action.json",
    ownerOsIntegration: "apps/ai-gateway-service/evidence/phase1885a-owner-os-file-action-result-integration.json",
  },
});

function readRegisteredAction() {
  try {
    const text = readFileSync(resolve(repoRoot, ownerAutomationCommandRegistryPath), "utf8");
    const registry = JSON.parse(text);
    return registry.actions?.find((item) => item?.actionId === "create_desktop_spreadsheet") ?? commandFallback;
  } catch {
    return commandFallback;
  }
}

function buildOwnerAutomationCommandPaletteCopy(action = readRegisteredAction()) {
  const evidenceRefs = action.evidenceRefs ?? commandFallback.evidenceRefs;

  return Object.freeze({
    title: "小天现在会做什么",
    subtitle: "这里先列出已经登记的本地安全动作。第一批只开放预览和说明，真实运行需要你单独确认。",
    registeredActionCount: 1,
    command: Object.freeze({
      actionId: action.actionId ?? commandFallback.actionId,
      name: action.ownerFacingName ?? commandFallback.ownerFacingName,
      displayName: action.displayName ?? commandFallback.displayName,
      description: action.description ?? commandFallback.description,
      status: "已登记，可用；检测到确认后只允许执行一次受控创建。",
      dryRunPreviewLabel: "查看预览",
      safetyLabel: "查看安全说明",
      advancedRecordLabel: "查看高级记录",
      disabledRealRunLabel: "真实创建需要单独确认，本阶段不会执行。",
      approvalRequiredLine: "真实运行需要 owner approval。",
      safetyItems: [
        "默认先预览",
        "真实创建前需要确认",
        "不覆盖已有文件",
        "不扫描桌面",
        "不读取桌面其他文件",
        "不调用真实模型",
        "不读取密钥",
      ],
      previewItems: [
        "预览目标：桌面 CSV 任务表",
        "预览字段：任务、状态、备注",
        "预览模式：dry-run first，不创建文件",
      ],
      previewIntro: "预览会展示将要创建的表格内容，但不会写入桌面。",
      previewPrimary: "查看预览只会读取已生成的预览记录，不会创建文件。",
      previewGridItems: [
        { label: "预览字段", value: "任务、状态、备注" },
        { label: "文件动作", value: "不会创建文件" },
        { label: "打开动作", value: "不会打开 Excel / WPS" },
        { label: "桌面边界", value: "不会扫描桌面" },
      ],
      previewEvidenceItems: [
        "动作合约已记录，可在高级记录查看。",
        "预览证据已记录，可在高级记录查看。",
        "命令面板封口证据已记录，可在高级记录查看。",
      ],
      previewMutedLine: "真实创建仍需要单独 owner approval；这里只展示预览层级和证据摘要。",
      advancedRecordItems: [
        `动作登记：${ownerAutomationCommandRegistryPath}`,
        `schema：${ownerAutomationCommandSchemaPath}`,
        `dry-run evidence：${evidenceRefs.dryRun}`,
        `real-run evidence：${evidenceRefs.realRun}`,
        `Owner OS evidence：${evidenceRefs.ownerOsIntegration}`,
        `Command Palette evidence：${ownerAutomationCommandEvidencePath}`,
        `Command Palette v1 seal：${ownerAutomationCommandV1SealEvidencePath}`,
        `Preview drawer evidence：${ownerAutomationDryRunPreviewDrawerEvidencePath}`,
      ],
      realRunRequiresApproval: action.realRunRequiresApproval === true,
      realRunApprovalDetected: hasValidPhase1905Approval(),
      defaultDryRunFirst: action.defaultDryRunFirst === true,
      overwritePolicy: action.overwritePolicy ?? commandFallback.overwritePolicy,
      forbiddenCapabilities: action.forbiddenCapabilities ?? [],
    }),
  });
}

export { buildOwnerAutomationCommandPaletteCopy };

export const ownerAutomationCommandPaletteCopy = buildOwnerAutomationCommandPaletteCopy();
