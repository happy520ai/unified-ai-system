import { existsSync, statSync } from "node:fs";
import { extname } from "node:path";
import {
  check,
  containsRawBaseUrlValue,
  containsSecretLikeValue,
  containsWebhookLikeValue,
  finalize,
  has,
  p,
  readJson,
  readText,
  safetyBoundary,
} from "../phase632-common.mjs";

const paths = {
  previousEvidence: "apps/ai-gateway-service/evidence/phase1891a-owner-automation-command-palette-v1.json",
  runner: "tools/phase1899a/run-command-palette-visual-smoke.mjs",
  verifier: "tools/phase1899a/validate-command-palette-visual-smoke.mjs",
  docs: "docs/automation/phase1899a-command-palette-visual-smoke.md",
  evidence: "apps/ai-gateway-service/evidence/phase1899a-command-palette-visual-smoke.json",
  screenshotDir: "apps/ai-gateway-service/evidence/phase1899a/screenshots",
  screenshot: "apps/ai-gateway-service/evidence/phase1899a/screenshots/command-palette-visual-smoke.png",
  domSnapshot: "apps/ai-gateway-service/evidence/phase1899a/command-palette-visual-smoke.html",
  registry: "docs/automation/registered-owner-actions.json",
  schema: "docs/automation/owner-automation-action-registry.schema.json",
  phase1891Evidence: "apps/ai-gateway-service/evidence/phase1891a-owner-automation-command-palette-v1.json",
  packageJson: "package.json",
};

const expected = {
  title: "小天现在会做什么",
  command: "帮我在桌面建一个表格",
  description: "在桌面创建一个 CSV 任务表，并尝试自动打开。",
  status: "已登记，可用，但真实运行前需要你确认。",
  dryRunFirst: "预览模式：dry-run first，不创建文件",
  approvalRequired: "真实运行需要 owner approval。",
  disabledRealRun: "真实创建需要单独确认，本阶段不会执行。",
  safetyItems: [
    "默认先预览",
    "真实创建前需要确认",
    "不覆盖已有文件",
    "不扫描桌面",
    "不读取桌面其他文件",
    "不调用真实模型",
    "不读取密钥",
  ],
};

const scriptName = "smoke:phase1899a-command-palette-visual-smoke";
const scriptCommand = "node tools/phase1899a/run-command-palette-visual-smoke.mjs && node tools/phase1899a/validate-command-palette-visual-smoke.mjs";

const previousEvidence = readJson(paths.previousEvidence);
const evidence = readJson(paths.evidence);
const packageJson = readJson(paths.packageJson);
const runnerText = readText(paths.runner);
const verifierText = readText(paths.verifier);
const docsText = readText(paths.docs);
const evidenceText = readText(paths.evidence);
const domText = readText(paths.domSnapshot);
const combinedText = [runnerText, verifierText, docsText, evidenceText, domText].join("\n");

const previous = previousEvidence.data ?? {};
const data = evidence.data ?? {};
const scripts = packageJson.data?.scripts ?? {};

function fileExists(relativePath) {
  return existsSync(p(relativePath));
}

function fileSize(relativePath) {
  return fileExists(relativePath) ? statSync(p(relativePath)).size : 0;
}

function extractElementHtml(text, marker, closingTag) {
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) return "";
  const openIndex = text.lastIndexOf("<", markerIndex);
  if (openIndex < 0) return "";
  const closeIndex = text.indexOf(closingTag, markerIndex);
  if (closeIndex < 0) return text.slice(openIndex);
  return text.slice(openIndex, closeIndex + closingTag.length);
}

const paletteHtml = extractElementHtml(domText, 'data-owner-automation-command-palette="true"', "</section>");
const cardHtml = extractElementHtml(domText, 'data-owner-automation-command-card="true"', "</article>");
const evidenceDrawerHtml = extractElementHtml(domText, 'data-owner-command-evidence-drawer="true"', "</details>");

const previousPhaseReady =
  previousEvidence.exists === true &&
  !previousEvidence.parseErrorReason &&
  previous.completed === true &&
  previous.recommended_sealed === true &&
  previous.blocker === null &&
  previous.commandPaletteVisible === true &&
  previous.registeredActionCount === 1 &&
  previous.createDesktopSpreadsheetCommandVisible === true &&
  previous.dryRunPreviewEntryVisible === true &&
  previous.realRunApprovalRequiredVisible === true &&
  previous.realRunButtonEnabled === false;

const commandPaletteVisible =
  domText.includes('data-owner-automation-command-palette="true"') &&
  domText.includes(expected.title);

const createDesktopSpreadsheetCommandVisible =
  domText.includes('data-owner-automation-action-id="create_desktop_spreadsheet"') &&
  domText.includes(expected.command) &&
  domText.includes(expected.description) &&
  domText.includes(expected.status);

const dryRunPreviewEntryVisible =
  domText.includes('data-owner-command-dry-run-preview="true"') &&
  domText.includes('data-owner-command-dry-run-entry="true"') &&
  domText.includes(expected.dryRunFirst);

const realRunApprovalRequiredVisible =
  domText.includes(expected.approvalRequired) &&
  domText.includes(expected.disabledRealRun) &&
  domText.includes('data-owner-command-real-run-gated="true"') &&
  /data-owner-command-real-run-gated="true"[^>]*disabled/.test(domText);

const safetyBoundaryCopyVisible =
  domText.includes('data-owner-command-safety-boundary="true"') &&
  expected.safetyItems.every((item) => domText.includes(item));

const evidenceDrawerAvailable =
  domText.includes('data-owner-command-evidence-drawer="true"') &&
  evidenceDrawerHtml.includes(paths.registry) &&
  evidenceDrawerHtml.includes(paths.schema) &&
  evidenceDrawerHtml.includes(paths.phase1891Evidence);

const realRunButtonEnabled = /data-owner-command-real-run-gated="true"(?![^>]*disabled)/.test(domText);
const executionButtonAdded = /立即真实创建|data-owner-command-real-run="true"/.test(domText);
const executionButtonGated = /data-owner-command-real-run-gated="true"[^>]*disabled/.test(domText) &&
  domText.includes(expected.disabledRealRun);
const desktopFileListVisible = /data-desktop-file-list|data-owner-desktop-file-list|data-file-browser="desktop"|桌面文件列表|desktop file list/i.test(domText);
const bulkFileActionVisible = /data-bulk-file-action|data-owner-bulk-file-action|data-desktop-bulk-file-action|批量创建|批量文件|批量操作|bulk file/i.test(domText);

const checks = [
  check("previous_phase_ready", previousPhaseReady),
  check("runner_exists", has(runnerText, "Phase1899A") && has(runnerText, "commandPaletteVisible")),
  check("verifier_exists", has(verifierText, "Phase1899A") && has(verifierText, "commandPaletteVisible")),
  check("docs_exists", has(docsText, "Phase1899A") && has(docsText, "Command Palette Visual Smoke")),
  check("evidence_exists", evidence.exists === true && !evidence.parseErrorReason),
  check("completed_true", data.completed === true),
  check("recommended_sealed_true", data.recommended_sealed === true),
  check("blocker_null", data.blocker === null),
  check("owner_os_opened", data.ownerOsOpened === true),
  check("ui_opened", data.uiOpened === true),
  check("command_palette_visible", data.commandPaletteVisible === true && commandPaletteVisible),
  check("registered_action_count_one", data.registeredActionCount === 1),
  check("create_desktop_spreadsheet_command_visible", data.createDesktopSpreadsheetCommandVisible === true && createDesktopSpreadsheetCommandVisible),
  check("owner_facing_command_name_visible", data.ownerFacingCommandNameVisible === true && domText.includes(expected.command)),
  check("dry_run_preview_entry_visible", data.dryRunPreviewEntryVisible === true && dryRunPreviewEntryVisible),
  check("real_run_approval_required_visible", data.realRunApprovalRequiredVisible === true && realRunApprovalRequiredVisible),
  check("safety_boundary_copy_visible", data.safetyBoundaryCopyVisible === true && safetyBoundaryCopyVisible),
  check("evidence_drawer_available", data.evidenceDrawerAvailable === true && evidenceDrawerAvailable),
  check("real_run_button_enabled_false", data.realRunButtonEnabled === false && realRunButtonEnabled === false),
  check("execution_button_not_added_or_gated", data.executionButtonAdded === false || data.executionButtonGated === true),
  check("desktop_file_list_visible_false", data.desktopFileListVisible === false && desktopFileListVisible === false),
  check("bulk_file_action_visible_false", data.bulkFileActionVisible === false && bulkFileActionVisible === false),
  check("new_file_created_false", data.newFileCreated === false),
  check("desktop_scan_performed_false", data.desktopScanPerformed === false),
  check("desktop_other_files_read_false", data.desktopOtherFilesRead === false),
  check("screenshot_created", data.screenshotPath === paths.screenshot && fileExists(paths.screenshot) && fileSize(paths.screenshot) > 0),
  check("screenshot_png", extname(paths.screenshot).toLowerCase() === ".png"),
  check("dom_snapshot_created", data.domSnapshotPath === paths.domSnapshot && fileExists(paths.domSnapshot) && fileSize(paths.domSnapshot) > 0),
  check("dom_contains_owner_os", domText.includes('data-owner-os-shell="true"')),
  check("dom_contains_command_palette", commandPaletteVisible),
  check("dom_contains_command_card", cardHtml.includes('data-owner-automation-action-id="create_desktop_spreadsheet"')),
  check("dom_contains_evidence_drawer", evidenceDrawerAvailable),
  check("dom_does_not_contain_enabled_real_run", realRunButtonEnabled === false),
  check("dom_does_not_contain_desktop_file_list", desktopFileListVisible === false),
  check("dom_does_not_contain_bulk_file_action", bulkFileActionVisible === false),
  check("provider_calls_made_false", data.providerCallsMade === false),
  check("legacy_scripts_executed_false", data.legacyScriptsExecuted === false),
  check("chat_modified_false", data.chatModified === false),
  check("chat_gateway_execute_modified_false", data.chatGatewayExecuteModified === false),
  check("deploy_executed_false", data.deployExecuted === false),
  check("production_ready_claimed_false", data.productionReadyClaimed === false),
  check("raw_secret_read_false", data.rawSecretRead === false),
  check("auth_json_read_false", data.authJsonRead === false),
  check("raw_credential_ref_read_false", data.rawCredentialRefRead === false),
  check("package_script_present", scripts[scriptName] === scriptCommand),
  check("secret_value_exposed_false", containsSecretLikeValue(combinedText) === false),
  check("raw_base_url_value_exposed_false", containsRawBaseUrlValue(combinedText) === false),
  check("webhook_value_exposed_false", containsWebhookLikeValue(combinedText) === false),
];

const result = {
  phase: "Phase1899A",
  routeChoice: "Route A / local_self_use_only",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  previousPhaseReady,
  ownerOsOpened: data.ownerOsOpened === true,
  uiOpened: data.uiOpened === true,
  commandPaletteVisible,
  registeredActionCount: data.registeredActionCount ?? null,
  createDesktopSpreadsheetCommandVisible,
  ownerFacingCommandNameVisible: domText.includes(expected.command),
  dryRunPreviewEntryVisible,
  realRunApprovalRequiredVisible,
  safetyBoundaryCopyVisible,
  evidenceDrawerAvailable,
  realRunButtonEnabled,
  executionButtonAdded,
  executionButtonGated,
  desktopFileListVisible,
  bulkFileActionVisible,
  newFileCreated: data.newFileCreated === true,
  desktopScanPerformed: data.desktopScanPerformed === true,
  desktopOtherFilesRead: data.desktopOtherFilesRead === true,
  screenshotPath: data.screenshotPath ?? paths.screenshot,
  screenshotsPath: paths.screenshotDir,
  domSnapshotPath: data.domSnapshotPath ?? paths.domSnapshot,
  evidencePath: paths.evidence,
  ownerFacingCommandName: data.ownerFacingCommandName ?? expected.command,
  paletteHtmlFound: paletteHtml.length > 0,
  cardHtmlFound: cardHtml.length > 0,
  evidenceDrawerHtmlFound: evidenceDrawerHtml.length > 0,
  ...safetyBoundary(),
  providerCallsMade: data.providerCallsMade === false ? false : data.providerCallsMade,
  legacyScriptsExecuted: data.legacyScriptsExecuted === false ? false : data.legacyScriptsExecuted,
  chatModified: data.chatModified === false ? false : data.chatModified,
  chatGatewayExecuteModified: data.chatGatewayExecuteModified === false ? false : data.chatGatewayExecuteModified,
  deployExecuted: data.deployExecuted === false ? false : data.deployExecuted,
  productionReadyClaimed: data.productionReadyClaimed === false ? false : data.productionReadyClaimed,
  rawSecretRead: data.rawSecretRead === false ? false : data.rawSecretRead,
  authJsonRead: data.authJsonRead === false ? false : data.authJsonRead,
  rawCredentialRefRead: data.rawCredentialRefRead === false ? false : data.rawCredentialRefRead,
};

finalize(result, checks, paths.evidence, "phase1899a_command_palette_visual_smoke_failed");
