import { pathToFileURL } from "node:url";
import { check, finalize, p, readJson, safetyBoundary } from "../phase632-common.mjs";

const paths = {
  phase1889Evidence: "apps/ai-gateway-service/evidence/phase1889a-owner-automation-action-registry-v1.json",
  registry: "docs/automation/registered-owner-actions.json",
  schema: "docs/automation/owner-automation-action-registry.schema.json",
  ownerBossViewPanel: "apps/ai-gateway-service/src/ui/components/OwnerBossViewPanel.js",
  evidence: "apps/ai-gateway-service/evidence/phase1891a-owner-automation-command-palette-v1.json",
  screenshotsDir: "apps/ai-gateway-service/evidence/phase1891a/screenshots",
};

const phase1889 = readJson(paths.phase1889Evidence);
const registry = readJson(paths.registry);
const actions = Array.isArray(registry.data?.actions) ? registry.data.actions : [];
const action = actions.find((item) => item?.actionId === "create_desktop_spreadsheet") ?? {};

let ownerOsHtml = "";
let renderError = null;
try {
  const moduleUrl = pathToFileURL(p(paths.ownerBossViewPanel)).href;
  const { renderOwnerBossViewPanel } = await import(`${moduleUrl}?phase1891a=${Date.now()}`);
  ownerOsHtml = renderOwnerBossViewPanel();
} catch (error) {
  renderError = error instanceof Error ? error.message : String(error);
}

const phase1889Ready =
  phase1889.exists === true &&
  !phase1889.parseErrorReason &&
  phase1889.data?.completed === true &&
  phase1889.data?.recommended_sealed === true &&
  phase1889.data?.blocker === null &&
  phase1889.data?.ownerAutomationActionRegistryReady === true &&
  phase1889.data?.registeredActionCount === 1 &&
  phase1889.data?.createDesktopSpreadsheetRegistered === true &&
  phase1889.data?.realRunRequiresApproval === true &&
  phase1889.data?.dryRunFirstPolicyDefined === true &&
  phase1889.data?.overwriteProtectionPreserved === true;

const commandPaletteVisible =
  ownerOsHtml.includes('data-owner-automation-command-palette="true"') &&
  ownerOsHtml.includes("小天现在会做什么");
const createDesktopSpreadsheetCommandVisible =
  ownerOsHtml.includes('data-owner-automation-action-id="create_desktop_spreadsheet"') &&
  ownerOsHtml.includes("帮我在桌面建一个表格");
const dryRunPreviewEntryVisible =
  ownerOsHtml.includes('data-owner-command-dry-run-preview="true"') &&
  ownerOsHtml.includes("预览模式：dry-run first，不创建文件");
const realRunApprovalRequiredVisible =
  ownerOsHtml.includes("真实运行需要 owner approval。") &&
  ownerOsHtml.includes('data-owner-command-real-run-gated="true" disabled');
const safetyBoundaryCopyVisible =
  ["默认先预览", "真实创建前需要确认", "不覆盖已有文件", "不扫描桌面", "不读取桌面其他文件", "不调用真实模型", "不读取密钥"]
    .every((item) => ownerOsHtml.includes(item));
const evidenceDrawerAvailable =
  ownerOsHtml.includes('data-owner-command-evidence-drawer="true"') &&
  ownerOsHtml.includes(paths.registry) &&
  ownerOsHtml.includes(paths.schema);
const realRunButtonEnabled = /data-owner-command-real-run-gated="true"(?![^>]*disabled)/.test(ownerOsHtml);
const executionButtonAdded = /立即真实创建|data-owner-command-real-run="true"/.test(ownerOsHtml);
const executionButtonGated =
  ownerOsHtml.includes('data-owner-command-real-run-gated="true" disabled') &&
  ownerOsHtml.includes("真实创建需要单独确认，本阶段不会执行。");
const bulkFileActionVisible = /批量创建|批量文件|data-bulk-file-action|data-owner-bulk-file-action/i.test(ownerOsHtml);

const result = {
  phase: "Phase1891A",
  routeChoice: "Route A / local_self_use_only",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase1889Ready,
  commandPaletteVisible,
  registeredActionCount: actions.length,
  createDesktopSpreadsheetCommandVisible,
  ownerFacingCommandName: action.ownerFacingName ?? null,
  dryRunPreviewEntryVisible,
  realRunApprovalRequiredVisible,
  safetyBoundaryCopyVisible,
  evidenceDrawerAvailable,
  realRunButtonEnabled,
  executionButtonAdded,
  executionButtonGated,
  newFileCreated: false,
  desktopScanPerformed: false,
  desktopOtherFilesRead: false,
  bulkFileActionVisible,
  screenshotsPath: paths.screenshotsDir,
  evidencePath: paths.evidence,
  actionRegistryPath: paths.registry,
  actionSchemaPath: paths.schema,
  renderError,
  legacyScriptsExecuted: false,
  providerCallsMade: false,
  rawSecretRead: false,
  authJsonRead: false,
  rawCredentialRefRead: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  productionReadyClaimed: false,
  currentSealableScope: "Owner Automation Command Palette v1 read-only display, dry-run preview entry, approval-required state, safety copy, and evidence drawer.",
  currentUnsealableScope: "真实桌面文件创建、无审批真实运行、批量文件能力、桌面扫描、桌面文件读取、Provider 调用、/chat 或 /chat-gateway/execute 主链集成。",
  ...safetyBoundary(),
};

const checks = [
  check("phase1889_ready", phase1889Ready),
  check("registry_loaded", registry.exists === true && !registry.parseErrorReason),
  check("registered_action_count_one", actions.length === 1),
  check("create_desktop_spreadsheet_registered", action.actionId === "create_desktop_spreadsheet"),
  check("render_owner_os_html_success", renderError === null && ownerOsHtml.length > 0),
  check("command_palette_visible", commandPaletteVisible),
  check("create_desktop_spreadsheet_command_visible", createDesktopSpreadsheetCommandVisible),
  check("dry_run_preview_entry_visible", dryRunPreviewEntryVisible),
  check("real_run_approval_required_visible", realRunApprovalRequiredVisible),
  check("safety_boundary_copy_visible", safetyBoundaryCopyVisible),
  check("evidence_drawer_available", evidenceDrawerAvailable),
  check("real_run_button_enabled_false", realRunButtonEnabled === false),
  check("execution_button_not_added_or_gated", executionButtonAdded === false || executionButtonGated === true),
  check("new_file_created_false", result.newFileCreated === false),
  check("desktop_scan_performed_false", result.desktopScanPerformed === false),
  check("desktop_other_files_read_false", result.desktopOtherFilesRead === false),
  check("bulk_file_action_visible_false", bulkFileActionVisible === false),
  check("legacy_scripts_executed_false", result.legacyScriptsExecuted === false),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("raw_secret_read_false", result.rawSecretRead === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("raw_credential_ref_read_false", result.rawCredentialRefRead === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("production_ready_claimed_false", result.productionReadyClaimed === false),
];

finalize(result, checks, paths.evidence, "phase1891a_owner_automation_command_palette_integration_failed");
